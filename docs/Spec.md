# Specification

## General Purpose

The app should be used for the team to organize travel together in a better way while everyone is planning / booking things separately.

## Architecture 

- The application should be deployed through the docker-compose file.
- It should be a progressive web app (PWA) using react js.
- The backend should use node js.
- It should have the possibility to run locally without the full docker compose, to test the PWA without the need to redeploy or run the full docker stack.
- The app's user interace does not need to be multi lingual. Hardcoded German texts and symbols are enough.
- Sessions should be managed through JWT tokens.
- Uploaded media should be stored in a mounted volume.
- The database migrations should be idempotent, i.e., running them again on an existing database should lead to the same outcome.

## Deployment information

- The deployed domain is https://teamxtreme.bendun.io/
- Cloudflare for the deployment is setup.
- The Google Auth information as depicted by the local .env is created on the deployment.

## Design

- The overall design/coloring should follow https://bjj-karlsruhe.de/

## Security

- File uploads should run through a malware scan (ClamAV sidecar) before they are stored in an accessible manner.
- Protect agains CSRF and XSS, especially stored XSS.
- Protect against login brute forcing by having a failed attempt counter that is reset upon successfull login. If the counter reaches 10, block logins from the trying IP for 10 minutes.

## Test cases

- There should be a folder /tests that contains testcases that can be run locally to test all functionality and APIs. 
- There should also be specifically security tests, i.e., non users trying to get or modify operations or non admin users to do tasks that only admins should be able to.

## Features

- There should be a health endpoint for docker compose to use in the backend.

### User Management

- People should be able to log in using a password or Google/Instagram social logins after beeing invited.
- The invite should be a per person invite and users should not be able to invite further users. Only admins can add someone.
- Regarding the invitation. In addition to the copy link, the admin also gets a button "Send E-Mail" that uses a mailto: link to start a mail program with the invitation link.
- The user should be able to manage his/her own profile by setting a name and a profile picture. If social login is used, it should also use the profile picture from there as starting profile picture.
- Users should be able to add in their profile an email address, a phone number and an instragram handle in order to be contacted by other users.

### Core information sharing

- Everyone should be able to add their flight information and there should be an overview of flights.
- People should be able to add an accomodation and people should be able to assign themselves or beeing assigned (accept that assignment) to an accomodation. The accomodation should have a location and a start and endate plus a field for extra information.
- Similar a person should be able to add a rental vehicle and a number of how many people fit in that vehicle.
- The users should be able to share images and videos in original file quality through the app with each other.
- The view showing the images should only show a thumbnail for better performance. There should be at the top right a download all button and upon click of the image a higher resolution should load with the option of downloading the single one. The thumbnail should be created upon upload and also for the videos there should be just a thumbnail with an indication that it is a video.

### Starting Page

- The starting page should contain a list of cards below each other with general information. This can be hardcoded.
- It should start with a header picture.
- Second there should be a list of open user tasks, if no open user task is there, this card should not be shown.
- Then there should be the list of training times and the location where is trained. 
- Then traveling information (nearest Airport is Malaga). 
- Then there should be a card with helpful links (put there as buttons).
  - One link to a WhatsApp Group.
  - One link to https://www.leogalatijiujitsu.com/ "Website of the Leo Galati Team".
- Finally a recommendation on what to pack for the travel.

### User tasks

The user has to add at least a flight to the camp and one returning flight plus an accommodation.
Each missing part is an open task that should be shown on the starting page.

### Bottom Navigation

There should be a navigation on the bottom (mobile first view). This navigation should have the elements:
- "Home" show that starting page,
- "Calendar" should show the calendar view,
- "Travel" should show the flights view,
- "Accommodation" should show the accomodation view,
- "Vehicles" should show the vehicle page,
- "Settings" should go to the profile settings of the user,
- and if the user is an admin "Admin". Admin is for now the invites page.

The navigation should use appropriate icons and avoid text whenever possible.


### Other features

- The app should have a 'share' option to share the link to the app with someone via phone.
- There should be a calendar view in a table format. It should start with the first flight as first column and end with the last returning flight as columns. Then it should have one row per user and visualize in the fields if the user is already there and not yet returned as well as the accomodation the user is staying. The users should be sorted by arrival time (first flight).
- In the calendar view, when clicked on a user, it should open an overlay that shows the different contact options for the user, i.e., the mail adress with an icon to click on that has a mailto link, similar a phone and a whatsapp link and an instagram link.