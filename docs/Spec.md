# Specification

## Architecture 

- The application should be deployed through the docker-compose file.
- It should be a progressive web app (PWA) using react js.
- The backend should use node js.
- It should have the possibility to run locally without the full docker compose, to test the PWA without the need to redeploy or run the full docker stack.
- The app's user interace does not need to be multi lingual. Hardcoded German texts and symbols are enough.
- Sessions should be managed through JWT tokens.
- Uploaded media should be stored in a mounted volume.
- The database migrations should be idempotent, i.e., running them again on an existing database should lead to the same outcome.

## General Purpose

The app should be used for the team to organize travel together in a better way while everyone is planning / booking things separately.

## Deployment information

- The deployed domain is https://teamxtreme.bendun.io/
- Cloudflare for the deployment is setup.
- The Google Auth information as depicted by the local .env is created on the deployment.

## Design

- The overall design/coloring should follow https://bjj-karlsruhe.de/

## Features

- There should be a health endpoint for docker compose to use in the backend.
- People should be able to log in using a password or Google/Instagram social logins after beeing invited. The invite should be a per person invite and users should not be able to invite further users. Only admins can add someone.
- Everyone should be able to add their flight information and there should be an overview of flights.
- People should be able to add an accomodation and people should be able to assign themselves or beeing assigned (accept that assignment) to an accomodation. The accomodation should have a location and a start and endate plus a field for extra information.
- Similar a person should be able to add a rental vehicle and a number of how many people fit in that vehicle.
- The app should have a 'share' option to share the link to the app with someone via phone.
- The users should be able to share images and videos in original file quality through the app with each other.
- The user should be able to manage his/her own profile by setting a name and a profile picture. If social login is used, it should also use the profile picture from there as starting profile picture.
- The starting page should contain a list of cards below each other with general information. This can be hardcoded. It should start with a header picture, then there should be the list of training times and the location where is trained. Then traveling information (nearest Airport is Malaga). Finally a recommendation on what to pack for the travel.