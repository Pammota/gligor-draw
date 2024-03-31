#!/bin/bash

echo "Host $1" >> /root/.ssh/config
echo "ProxyCommand cloudflared access ssh --hostname %h" >> /root/.ssh/config

ssh-keyscan $1 >> /root/.ssh/known_hosts

# Use sshpass to pass the password to ssh
sshpass -p "$4" ssh -o StrictHostKeyChecking=no $3@$1

# Use sshpass to pass the password to ssh and execute the command
sshpass -p "$4" ssh -o StrictHostKeyChecking=no $3@$1 -p $2 "$5"
