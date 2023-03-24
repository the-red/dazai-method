FROM node:18.14.1

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

COPY . .
RUN yarn install && yarn build

# start app
CMD [ "yarn", "start" ]
