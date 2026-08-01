# APEX Contracts

Contratos compartidos del ecosistema.

## Estado

Paquete local real y consumido por Apex Drive. Contiene actualmente el Command
Bus físico tipado y su puerto de destino.

El Command Bus es la frontera explícita para mutaciones como:

- cambiar el modelo de neumático;
- cambiar parámetros operativos;
- seleccionar la superficie activa.

La telemetría no recibe este canal y permanece de solo lectura.

## Próximo paso

Incorporar gradualmente contratos serializables de pista, sesión y telemetría
cuando eso elimine dependencias cruzadas reales. No convertir este paquete en
un depósito genérico de tipos.

