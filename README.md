# AceY

Ace Stream Proxy

![console](https://raw.githubusercontent.com/xelaok/acey/master/wiki/landing-image.png)

## Installing
- Install Ace Stream server:<br />
  https://github.com/magnetikonline/docker-acestream-server
  
- Install [NodeJS](https://nodejs.org/en/) & NPM  

- Install and build proxy:

    ```bash
    cd acey
    npm install 
    npm run dist
    ```

## Usage
```bash
cd acey
node .
```

By default channels playlists will be available at the following urls:<br />
- http://localhost:8100/ace.m3u
- http://localhost:8100/ace-hls.m3u

## All-in-One
- https://hub.docker.com/r/sybdata/ace86a37
- https://hub.docker.com/r/sybdata/aceubase
