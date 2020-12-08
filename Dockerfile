FROM node:10
WORKDIR /usr/src/app
COPY package*.json ./
RUN yarn install
COPY . .
ENV PORT=8080
ENV GOOGLE_APPLICATION_CREDENTIALS='./marblek-project-622a726702af.json'
EXPOSE ${PORT}
CMD ["npm", "start"]