FROM node:14.17-alpine

RUN apk update || : && apk add python

ENV HOME=/home/node

USER node

RUN mkdir -p $HOME/app
WORKDIR $HOME/app

# Add source files
COPY . $HOME/app

# Install deps and compile TS
RUN npm install && \
    npm run build && \
    rm -f .npmrc

ENTRYPOINT ["npm"]
CMD ["start"]
