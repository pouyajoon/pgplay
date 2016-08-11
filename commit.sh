#!/bin/sh

cp Pokemon-GO-node-api/poke.io.js ./
cp Pokemon-GO-node-api/pokemon.proto ./

git add *
git commit -a -m "update..."

git pull origin master

git push origin master