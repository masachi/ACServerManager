# ACServerManager
![ac-logo](https://www.assettocorsa.net/wp-content/themes/AssettoCorsa/00-Style-Dev/ico/mstile-150x150.png)

Web based server manager for Assetto Corsa Server, that directly manipulating the ini files on the server as an alternative to the windows app and having to copy files to your server.

Start and stop the server, and stracker directly from the application, meaning you can make changes to the server configuration and restart the server directly from your browser or mobile phone.

Docker image available, see details below.

## ACServerManager on Linux
This is the installation guide for a Linux machine, to review the Windows installation guide go [here](https://github.com/jo3stevens/ACServerManager/blob/master/README.md).

## Updates
01/05/2018
* Dockerized! - Adding Docker build file to allow ACServerManager run in a container.

25/12/2017
* Add support for uploading tracks (both single and multi-layout) and cars
* Add support for removing existing tracks and cars
* Bumping version of ACServerManager to 1.0.0!

21/12/2017
* Update for 1.16 AC patch
* Added local car / skins generation script for v1.16 AC original + DLC content

24/05/2017
* Update for 1.14 AC patch
* Fixed a number of saving issues
* Added local car & track content option

27/01/2017:
* Update to UI layout
* Added restart feature for ACServer & sTracker server

17/10/2015:
* Bug fix when switching between two tracks with multiple track configs
* Added Max Ballast and UDP Plugin fields to Advanced page
* Added new setting for contentPath allowing server and content folders to be seperated (this happens when using a manager package from the kunos tool). If this setting it left empty it will assume the content folder is inside the server folder

22/08/2015:
* Finished adding all the new settings from 1.2 including tyres and weather

## Installation Details
First you'll need to install Node.js on your machine. It's best to use an application 
like [NVM](https://github.com/creationix/nvm) to manage the installation of Node.js on Linux based machines.
After installing Node.js, install [PM2](https://github.com/Unitech/pm2) when using this
version of  Manager, it's basically Node.js application management tool with tons of features
for production use. PM2 will make sure your web application stays online and, auto restarts if it crashes.

## Install NVM
To install NVM, follow the installation guide on its GitHub page [here](https://github.com/creationix/nvm). Please install NVM on the same account you run your Assetto Corsa Server.

## Install Node.js
Using NVM, run the following command to install the latest version:
```
nvm install node
```
If you would like to install a specific version using NVM then run something like this:
```
nvm install 8.5.0
```
I recommend using node version **v8.5.0** or newer, because of the upload content feature. Please see [comment](https://github.com/jo3stevens/ACServerManager/pull/36#issuecomment-393233010) for more information.

## Install PM2
To install PM2, follow the installation guide on its GitHub page [here](https://github.com/Unitech/pm2). Please install PM2 on the same account you run your Assetto Corsa Server.

## Install ACServerManager
Create a directory called 'acmanager', cd into that directory and run this command to download the latest version:
```
wget https://github.com/jo3stevens/ACServerManager/archive/master.zip
```
Unzip the file & clean up, by running:
```
unzip master.zip; mv ACServerManager-master/* .; rm -R ACServerManager-master; rm master.zip
```
You'll need to first configure your manager's settings before you can run the application.
## ACServerManager Configuration
To configure your manager's settings, open the 'settings.js' file. You'll see a number of variables, point the 'serverPath'
to your Assetto Corsa Server directory. You can configure your username, password & port settings for ACServerManager, also 
if you use sTracker, point the 'sTrackerPath' variable to your installation.

* serverPath: The path to your Assetto Corsa server directory
* contentPath: The path to your Assetto Corsa content directory, use this if hosting on the same machine for gaming. Leave blank if hosting on Linux.
* useLocalContent: If set to true, then ACServerManager will look for local car / track content
* sTrackerPath: The path to your sTracker directory that contains stracker.exe (If you don't run stracker just leave this as an empty string ('') to disable it
* username/password: Set these values if you want basic authentication on the application
* port: The port that the application will listen on (Be sure to open up this port on your firewall)

**Note:** The Assetto Corsa Server installation directory is set to '../server', change if necessary.

## Generating Local Content
On a remote Linux host machine, use the included script to generate empty folders of Assetto Corsa content, the ACServerManager web UI will use these folders.

Generate folders run:
```
./generate-frontend-content.sh
```
These folders are not included since git repositories do not support empty directories.

## Firewall
If your machine has a firewall enabled (i.e) iptables, you'll need to open / allow the ACServerManager port defined in your settings.js file.

## Running ACServerManager
You first need to make sure you have the necessary Node.js dependencies, run:
```
npm install
```
To run ACServerManager using PM2 run the following command:
```
pm2 start server.js
```
To monitor applications running with PM2 run:
```
pm2 list
```
There many useful commands to manage applications using PM2, reference their GitHub page.

## Docker Image
You can use the docker image easily run the entire ACServerManager inside a container. The build currently grabs the latest version of steamcmd & installs all the necessary files, dependencies & executables on top of a ubuntu:xenial (16.04) image.

[![](https://images.microbadger.com/badges/image/pringlez/acserver-manager.svg)](https://microbadger.com/images/pringlez/acserver-manager "Get your own image badge on microbadger.com") [![](https://images.microbadger.com/badges/version/pringlez/acserver-manager.svg)](https://microbadger.com/images/pringlez/acserver-manager "Get your own version badge on microbadger.com") [![](https://images.microbadger.com/badges/commit/pringlez/acserver-manager.svg)](https://microbadger.com/images/pringlez/acserver-manager "Get your own commit badge on microbadger.com")

Pull the latest image:
```
docker pull pringlez/acserver-manager
```
To run the container:
```
sudo docker run -d --name acserver-manager --restart unless-stopped --net=host -e PUID=<UID> -e PGID=<GID> -e TZ=<timezone> -v </path/to/acserver>:/home/gsa/server pringlez/acserver-manager
```

Then just visit your server's address + ACServerManager port in your browser!

**Note:** If you want to change the port number the application runs on, you can build your own local image using the example below  & pass in the desired port number in the parameter.

If you need to login to the running docker container:
```
docker exec -it acserver-manager /bin/bash
```

### Parameters
The parameters you need to include are the following:

* --net=host - Shares host networking with container, required.
* --restart unless-stopped - This will restart your container if it crashes
* -v /home/gsa/server - Volume mount the ACServer installation directory (Required)
* -e PGID for for GroupID - see below for explanation
* -e PUID for for UserID - see below for explanation
* -e TZ for timezone information, Europe/London

### User / Group Identifiers
Sometimes when using data volumes (-v flags) permissions issues can arise between the host OS and the container. We avoid this issue by allowing you to specify the user PUID and group PGID. Ensure the data volume directory on the host is owned by the same user you specify and it will "just work" <sup>TM</sup>.

In this instance PUID=1001 and PGID=1001. To find yours use id user as below:
```
  $ id <dockeruser>
    uid=1001(dockeruser) gid=1001(dockergroup) groups=1001(dockergroup)
```

#### Config Saving Issues
If you have issues saving the configuration settings in ACServerManager application, while it's running in the docker container. Try 'chmod 777' your ACServer directory. This should allow the application inside the container access the mounted ACServer volume.

### Building an Image
You can however build a local image if want to include any new changes to ACServerManager.

You need to specify the ports you'll be using for the ACServerManager. The docker build will expose the ports you specify.

Build a local docker image by:
```
docker build --build-arg ACMANAGER_PORT=42555 --build-arg VCS_REF=`git rev-parse --short HEAD` -t pringlez/acserver-manager .
```

## Using ACServerManager
* Browse to the application using your servers IP and the chosen port (or any DNS configured)
* Click the 'Start' button under Assetto Corsa Server section
* If using sTracker wait until the ACServer has started and then click 'Start' in the sTracker Server section

The server should now be running. You'll be able to see any server output in the command window and it will be logged to a file in the 'ACServerManager/log' folder.

You can change any of settings and it will be applied directly to server_cfg.ini and entry_list.ini on the server. After making a change just stop and start the server from the Server Status page to apply the changes to Assetto Corsa Server.

**Note:** The server may fail to start in some cases if the Assetto Corsa Server cannot connect to the master server. Make sure you portforward / open
the necessary ports for the server to function correctly.

## Screenshots
### Server Status
![Server Status](http://deltahosting.dyndns.org:8080/acmanager/screen-cap-1.jpg)

### Server Configuration
![Server Config](http://deltahosting.dyndns.org:8080/acmanager/screen-cap-2.jpg)

### Entry List
![Entry List](http://deltahosting.dyndns.org:8080/acmanager/screen-cap-3.jpg)

### Rules
![Rules](http://deltahosting.dyndns.org:8080/acmanager/screen-cap-4.jpg)

### Advanced
![Advanced](http://deltahosting.dyndns.org:8080/acmanager/screen-cap-5.jpg)

### Templates
![Templates](http://deltahosting.dyndns.org:8080/acmanager/screen-cap-6.jpg)

### Tracks
![Tracks](http://deltahosting.dyndns.org:8080/acmanager/screen-cap-7.jpg)

### Cars
![Cars](http://deltahosting.dyndns.org:8080/acmanager/screen-cap-8.jpg)

### Help
![Help](http://deltahosting.dyndns.org:8080/acmanager/screen-cap-9.jpg)
