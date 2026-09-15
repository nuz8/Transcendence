COMPOSE = docker compose
DRIZ_CONFIG_PATH = ./drizzle.config.ts

GREEN = \033[0;32m
YELLOW = \033[0;33m
BYELLOW = \033[1;33m
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

clean-avatars:
	find backend/public/avatars/uploads -type f ! -name .gitkeep -delete

fclean:
	$(COMPOSE) down --volumes --rmi all --remove-orphans

re:
	$(COMPOSE) stop
	$(COMPOSE) start

restart: down up

reset: fclean up

logs:
	$(COMPOSE) logs -f db

ps:
	$(COMPOSE) ps

db-gen:
	cd backend && npm run db:generate -- --config=$(DRIZ_CONFIG_PATH) --name=$(name)

db-migrate:
	cd backend && npm run db:migrate -- --config=$(DRIZ_CONFIG_PATH)

type-check:
	cd backend && npm run typecheck

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

	@printf '  $(DARK_GREY)make build$(RESET)                                  Build Compose services.\n'
	@printf '  $(DARK_GREY)make down$(RESET)                                   Stop and remove containers.\n'
	@printf '  $(RED)make clean                                  Remove containers and docker volumes.\n$(RESET)'
	@printf '  $(RED)make clean-avatars                          Remove all user-uploaded avatars from the repository.\n$(RESET)'
	@printf '  $(RED)make fclean                                 Remove containers, volumes, images, and orphans.\n$(RESET)'
	@printf '  $(DARK_GREY)make re$(RESET)                                     Restart containers with compose stop and start.\n'
	@printf '  $(DARK_GREY)make restart$(RESET)                                Restart containers with make targets down and up.\n'
	@printf '  $(RED)make reset                                  Perform fclean, then up.\n$(RESET)'
	@printf '  $(DARK_GREY)make logs$(RESET)                                   Follow PostgreSQL logs.\n'
	@printf '  $(DARK_GREY)make ps$(RESET)                                     Show container status.\n'
	@printf '  $(GREEN)make health-check                           Check PostgreSQL health.\n$(RESET)'
	@printf '  $(BYELLOW)make db-gen name=<update_description>       $(YELLOW)Generate Drizzle migration files (with a suitable name - optional but recommended).\n$(RESET)'
	@printf '  $(BYELLOW)make db-migrate                             $(YELLOW)Apply pending Drizzle migrations.\n$(RESET)'
	@printf '  $(DARK_GREY)make type-check$(RESET)                             Check TypeScript code for type errors.\n'
	@printf '  $(DARK_GREY)make help$(RESET)                                   Display this help message.\n'
