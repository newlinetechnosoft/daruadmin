.PHONY: run start stop

start:
	sudo systemctl start docker.service

run: start
	sudo docker compose -f docker-compose.local.yml up -d postgres minio

stop:
	sudo docker compose -f docker-compose.local.yml down

status:
	sudo docker compose -f docker-compose.local.yml ps
