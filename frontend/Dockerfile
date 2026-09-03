# Evaluation Service — frontend (React + Vite), local development image.

FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
