# Comandos Qdrant - Referência Rápida

## Iniciar Qdrant

docker start qdrant_inovar


## Parar Qdrant

docker stop qdrant_inovar


## Ver logs

docker logs qdrant_inovar


## Recriar do zero

docker stop qdrant_inovar
docker rm qdrant_inovar
# Depois rodar comando de criação novamente


## Popular novamente

node popular_qdrant.js


## Dashboard
http://localhost:6333/dashboard

## Backup
A pasta `qdrant_data` contém todos os dados.
Fazer backup dessa pasta = backup do banco.