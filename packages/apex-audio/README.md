# APEX Audio

Runtime de audio de APEX.

## Estado

Paquete local real y consumido por Apex Drive. Contiene `EngineSynth`, el
motor sintetizado y la reproducción de muestras asociadas al vehículo.

El código del runtime está separado de los archivos de audio. Las muestras
viven en `apex-assets` y permanecen clasificadas como internas hasta confirmar
su procedencia y licencia.

## Límite

Este paquete interpreta estado del vehículo y produce audio. No modifica la
simulación física.

