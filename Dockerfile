FROM node:12

WORKDIR /server

COPY package*.json /server/

RUN npm install

COPY ./ /server/

EXPOSE 5000

## THE LIFE SAVER
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.4.0/wait /wait
RUN chmod +x /wait

## Launch the wait tool and then your application

# # CMD /wait && npm start
CMD /wait && npm start
