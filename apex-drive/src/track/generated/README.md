# Fuentes de pista generadas

El servidor local de autoría escribe aquí archivos
`NNN-<track-id>-v<version>-track-source.json`.

Son fuentes autorales `apex-track-source@2`: combinan la definición del
catálogo con segmentos, conexiones, recorridos, controles, muestras físicas
finales y configuración del editor.
No deben editarse mientras el editor está guardando.

Las fuentes V1 existentes siguen siendo válidas. El loader las normaliza a un
segmento `main` y un recorrido `main-route`; el próximo guardado manual las
escribe como V2.

Durante `pnpm dev`, `ActiveTrack` consulta primero estas fuentes mediante el
servidor local. Si no encuentra una para el ID y versión seleccionados, usa la
geometría TypeScript legacy.
