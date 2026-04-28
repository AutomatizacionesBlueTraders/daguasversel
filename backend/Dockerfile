FROM node:20-alpine

WORKDIR /app

# Instalar dependencias del sistema necesarias para bcrypt
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Aplica migraciones y arranca
CMD ["sh", "-c", "npx knex migrate:latest --knexfile src/db/knexfile.js && node src/index.js"]
