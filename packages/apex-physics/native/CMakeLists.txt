cmake_minimum_required(VERSION 3.13 FATAL_ERROR)
set(CMAKE_POLICY_DEFAULT_CMP0077 NEW)

FIND_PACKAGE(Python3)
set(PYTHON ${Python3_EXECUTABLE} CACHE STRING "Python path")
set(EMSCRIPTEN_ROOT $ENV{EMSDK}/upstream/emscripten CACHE STRING "Emscripten path")
set(CMAKE_TOOLCHAIN_FILE ${EMSCRIPTEN_ROOT}/cmake/Modules/Platform/Emscripten.cmake)
set(WEBIDL_BINDER_SCRIPT ${EMSCRIPTEN_ROOT}/tools/webidl_binder.py)
set(JOLT_FRONT_MATTER_FILE ${CMAKE_CURRENT_SOURCE_DIR}/front-matter.js)
set(JOLT_HEADER_FILE ${CMAKE_CURRENT_SOURCE_DIR}/JoltJS.h)
set(JOLT_IDL_FILE ${CMAKE_CURRENT_SOURCE_DIR}/JoltJS.idl)
set(OUTPUT_FOLDER ${CMAKE_CURRENT_SOURCE_DIR}/dist/)
set(JOLT_TYPING ${OUTPUT_FOLDER}/types.d.ts)

# Option to turn on memory profiling
option(ENABLE_MEMORY_PROFILER "Enable emscriptens memory profiler to help find leaks" OFF)

# Option to turn on double precision
option(DOUBLE_PRECISION "Compile the library in double precision mode" OFF)

# Enable for resizable heap, with some amount of slowness
option(ALLOW_MEMORY_GROWTH "Allow Memory Growth" OFF)

# Default initial memory size is 128*1024*1024 = 128MB
set(INITIAL_MEMORY 134217728 CACHE STRING "Initial Memory")

# Default maximum memory size is 2*1024*1024*1024 = 2GB (only used when ALLOW_MEMORY_GROWTH is true)
set(MAXIMUM_MEMORY 2147483648 CACHE STRING "Maximum Memory")

# Apex ships one supported native artifact: an optimized external-WASM runtime.
set(CMAKE_CONFIGURATION_TYPES "Distribution")
if (NOT "${CMAKE_BUILD_TYPE}" STREQUAL "Distribution")
	message(FATAL_ERROR "Apex Physics native integration supports CMAKE_BUILD_TYPE=Distribution only")
endif()

# No floating point exception checking
set(FLOATING_POINT_EXCEPTIONS_ENABLED OFF)

# Turn off LTO
set(INTERPROCEDURAL_OPTIMIZATION OFF)

# Apex distributions do not include debug symbols.
set(GENERATE_DEBUG_SYMBOLS OFF)

# Turn off custom allocator
set(DISABLE_CUSTOM_ALLOCATOR ON)

# Turn off ObjectStream
set(ENABLE_OBJECT_STREAM OFF)

# Use 32-bit object layers to support more bits in ObjectLayerPairFilterMask
set(OBJECT_LAYER_BITS 32)

# The supported runtime is single-threaded with an external WASM artifact.
set(ENVIRONMENT_FLAG -s ENVIRONMENT=web,node,worker)
set(OUTPUT_BASE_NAME "${OUTPUT_FOLDER}apex-physics")
# Removing thread_local from generated bindings avoids an unnecessary residual
# allocation in the supported single-threaded runtime.
set(REMOVE_THREAD_LOCAL sed -i.bak -e "s:thread_local::g" glue.cpp)

# Replace 'replace_by_import' by 'import' in the generated JS code to workaround a bug in emscripten
# See: https://github.com/jrouwe/JoltPhysics.js/issues/245
set(REPLACE_IMPORT sed -i -e "s:replace_by_import:import:g")

# Include Jolt
include(FetchContent)
FetchContent_Declare(
        JoltPhysics
        GIT_REPOSITORY "https://github.com/jrouwe/JoltPhysics"
        # Jolt Physics v5.6.0. Pin the resolved commit for reproducible builds.
        GIT_TAG "e77f175595e64cb44218cc9d9d56fc365ad0e36a"
		SOURCE_SUBDIR "Build"
)
FetchContent_MakeAvailable(JoltPhysics)

# Enable resizable heap, with some amount of slowness. Default is 128*1024*1024 = 128MB
if (ALLOW_MEMORY_GROWTH)
	set(MEMORY_GROWTH_FLAG
		-s ALLOW_MEMORY_GROWTH=1
		-s MAXIMUM_MEMORY=${MAXIMUM_MEMORY})
else()
	set(MEMORY_GROWTH_FLAG "")
endif()

# Enable memory profiler
if (ENABLE_MEMORY_PROFILER)
	set(MEMORY_PROFILER_FLAG "--memoryprofiler")
	set(INCLUDE_DEMANGLE_ALL_FLAG "-s DEFAULT_LIBRARY_FUNCS_TO_INCLUDE='$demangleAll'")
	set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${MEMORY_PROFILER_FLAG}")
else()
	set(MEMORY_PROFILER_FLAG "")
	set(INCLUDE_DEMANGLE_ALL_FLAG "")
endif()

set(EMCC_ARGS
  -fno-rtti
  -fno-exceptions
  --extern-pre-js ${JOLT_FRONT_MATTER_FILE}
  --post-js glue.js
  --closure=1
  --closure-args="--dynamic_import_alias=replace_by_import"
  --closure-args="--externs"
  --closure-args="${CMAKE_CURRENT_SOURCE_DIR}/extern-import.js"
  --post-js ${CMAKE_CURRENT_SOURCE_DIR}/helpers.js
  ${MEMORY_GROWTH_FLAG}
  -s ALLOW_TABLE_GROWTH=1
  -s WASM_BIGINT=0
  ${ENVIRONMENT_FLAG}
  -s EXPORT_ES6=1
  -s EXPORT_NAME="Jolt"
  -s MODULARIZE=1
  -s NO_EXIT_RUNTIME=1
  -s NO_FILESYSTEM=1
  -s STACK_SIZE=1048576
  -s INITIAL_MEMORY=${INITIAL_MEMORY}
  -s EXPORTED_RUNTIME_METHODS=HEAP8,HEAPU8,HEAP16,HEAPU16,HEAP32,HEAPU32,HEAPF32,HEAPF64,UTF8ToString
  ${MEMORY_PROFILER_FLAG}
  ${INCLUDE_DEMANGLE_ALL_FLAG}
  -O3)

set(EMCC_WASM_ARGS ${EMCC_ARGS}
  -s BINARYEN_IGNORE_IMPLICIT_TRAPS=1
  -s WASM=1)

set(EMCC_GLUE_ARGS
  -c
  -I${JoltPhysics_SOURCE_DIR}/..
  -Wall
  -std=c++17
  -fno-rtti
  -fno-exceptions
  -DJPH_OBJECT_LAYER_BITS=32
  -DJPH_DISABLE_CUSTOM_ALLOCATOR
  -include ${JOLT_HEADER_FILE}
  ${MEMORY_PROFILER_FLAG}
  -DNDEBUG)

# Add double precision define
if (DOUBLE_PRECISION)
	set(EMCC_GLUE_ARGS ${EMCC_GLUE_ARGS} -DJPH_DOUBLE_PRECISION)
endif()

project("ApexPhysicsNative")

add_custom_command(
	OUTPUT ${JOLT_TYPING}
	COMMAND npx webidl-dts-gen -e -d -i jolt.idl -o ${JOLT_TYPING} -n Jolt
	DEPENDS jolt.idl
	COMMENT "Generating Apex Physics runtime typing"
	VERBATIM)

add_custom_command(
	OUTPUT glue.cpp glue.js jolt.idl
	BYPRODUCTS parser.out WebIDLGrammar.pkl
	COMMAND cat ${JOLT_IDL_FILE} > jolt.idl
	COMMAND ${PYTHON} ${WEBIDL_BINDER_SCRIPT} jolt.idl glue
	COMMAND ${REMOVE_THREAD_LOCAL}
	DEPENDS ${JOLT_IDL_FILE}
	COMMENT "Generating Apex Physics runtime bindings"
	VERBATIM)

add_custom_command(
	OUTPUT glue.o
	COMMAND emcc glue.cpp ${EMCC_GLUE_ARGS} -o glue.o
	DEPENDS glue.cpp ${JOLT_HEADER_FILE}
	COMMENT "Building Apex Physics runtime bindings"
	VERBATIM)
add_custom_target(apex-bindings ALL DEPENDS glue.js glue.o ${JOLT_TYPING})

add_custom_command(
	OUTPUT ${OUTPUT_BASE_NAME}.js ${OUTPUT_BASE_NAME}.wasm
	COMMAND emcc glue.o $<TARGET_FILE:Jolt> ${EMCC_WASM_ARGS} -o ${OUTPUT_BASE_NAME}.js
	COMMAND ${REPLACE_IMPORT} ${OUTPUT_BASE_NAME}.js
	DEPENDS apex-bindings ${JOLT_FRONT_MATTER_FILE} ${JOLT_TARGETS} ${JOLT_IDL_FILE} ${JOLT_HEADER_FILE}
	COMMENT "Building Apex Physics external WebAssembly runtime"
	VERBATIM)
add_custom_target(apex-wasm ALL DEPENDS ${OUTPUT_BASE_NAME}.js ${OUTPUT_BASE_NAME}.wasm)
