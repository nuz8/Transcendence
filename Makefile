COMPOSE = docker compose
DRIZ_CONFIG_PATH = ./drizzle.config.ts

GREEN = \033[0;32m
RED = \033[0;31m
DARK_GREY = \033[1;30m
RESET = \033[0m

.PHONY: up build down clean fclean restart reset logs ps db-gen db-migrate db-test type-check health-check help

up:
	$(COMPOSE) up --build -d

build:
	$(COMPOSE) build

down:
	$(COMPOSE) down

clean:
	$(COMPOSE) down -v

fclean:
	$(COMPOSE) down --volumes --rmi all --remove-orphans

restart:
	$(COMPOSE) down
	$(COMPOSE) up -d

reset: fclean up

logs:
	$(COMPOSE) logs -f db

ps:
	$(COMPOSE) ps

db-gen:
	cd backend && npm run db:generate -- --config=$(DRIZ_CONFIG_PATH)

db-migrate:
	cd backend && npm run db:migrate -- --config=$(DRIZ_CONFIG_PATH)

type-check:
	cd backend && npm run typecheck

db-test:
	cd backend && npm run test:db

health-check:
	@if status=$$(docker inspect -f '{{.State.Health.Status}}' transcend-db 2>/dev/null); then \
		if [ "$$status" = "healthy" ]; then \
			printf '$(GREEN)PostgreSQL is healthy: %s$(RESET)\n' "$$status"; \
		else \
			printf '$(RED)PostgreSQL is not healthy: %s$(RESET)\n' "$$status"; \
			exit 1; \
		fi; \
	else \
		printf '$(RED)PostgreSQL container is not running or does not exist.$(RESET)\n'; \
		exit 1; \
	fi

help:
	@printf 'Available targets:\n'
	@printf '  $(DARK_GREY)make up$(RESET)           Start PostgreSQL and build images if needed.\n'
	@printf '  $(DARK_GREY)make build$(RESET)        Build Compose services.\n'
	@printf '  $(DARK_GREY)make down$(RESET)         Stop and remove containers.\n'
	@printf '  $(DARK_GREY)make clean$(RESET)        Remove containers and volumes.\n'
	@printf '  $(DARK_GREY)make fclean$(RESET)       Remove containers, volumes, images, and orphans.\n'
	@printf '  $(DARK_GREY)make restart$(RESET)      Restart containers.\n'
	@printf '  $(DARK_GREY)make reset$(RESET)        Perform fclean, then start again.\n'
	@printf '  $(DARK_GREY)make logs$(RESET)         Follow PostgreSQL logs.\n'
	@printf '  $(DARK_GREY)make ps$(RESET)           Show container status.\n'
	@printf '  $(DARK_GREY)make health-check$(RESET) Check PostgreSQL health.\n'
	@printf '  $(DARK_GREY)make db-gen$(RESET)       Generate Drizzle migration files.\n'
	@printf '  $(DARK_GREY)make db-migrate$(RESET)   Apply pending Drizzle migrations.\n'
	@printf '  $(DARK_GREY)make db-test$(RESET)      Run database integration tests.\n'
	@printf '  $(DARK_GREY)make type-check$(RESET)   Check TypeScript code for type errors.\n'
	@printf '  $(DARK_GREY)make help$(RESET)         Display this help message.\n'