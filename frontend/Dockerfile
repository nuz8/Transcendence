FROM node:22.22.3-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm install
COPY . .
EXPOSE 4200

CMD ["npm", "start", "--", "--host=0.0.0.0"]
