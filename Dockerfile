FROM node:14.17-alpine

RUN apk add --update --no-cache \
    make \
    g++ \
    jpeg-dev \
    cairo-dev \
    giflib-dev \
    pango-dev \
    libtool \
    autoconf \
    automake

ENV HOME=/home/node

USER node

RUN mkdir -p $HOME/app
WORKDIR $HOME/app

# Add source files
COPY . $HOME/app

# Install deps and compile TS
RUN npm install

ENTRYPOINT ["npm"]
CMD ["start"]
