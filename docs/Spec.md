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
- There should be a github dependabot workflow for at least all package.json, Dockerfile and docker compose files to ensure regular updates.
- For all admin features, ensure that there is a test that only admins can use them and other users or unauthenticated ones cannot.

## Test cases

- There should be a folder /tests that contains testcases that can be run locally to test all functionality and APIs. 
- There should also be specifically security tests, i.e., non users trying to get or modify operations or non admin users to do tasks that only admins should be able to.
- Create a github action that runs the test suite on pull requests.
- Create a script for testing that takes from .env the admin credentials and asks questions to add a user. It can either be given a file specifying further input or it should ask for input. It should ask for the name, email (optional), phone (optional), instagram handle (optional), arrival flight information, departing flight information, accomodation (either select an existing or adding one). Then it should create a file specifying the input (for re-use) and create the entry in the deployed system corresponding via http requests.

## Features

- There should be a health endpoint for docker compose to use in the backend.

### User Management

- People should be able to log in using a password or Google/Instagram social logins after beeing invited.
- The invite should be a per person invite and users should not be able to invite further users. Only admins can add someone.
- Regarding the invitation. In addition to the copy link, the admin also gets a button "Send E-Mail" that uses a mailto: link to start a mail program with the invitation link.
- The user should be able to manage his/her own profile by setting a name and a profile picture. If social login is used, it should also use the profile picture from there as starting profile picture.
- Users should be able to add in their profile an email address, a phone number and an instragram handle in order to be contacted by other users.
- Admins should through their panel also have the possibilities to delete single users. This should be done from the invitation management.

### Admin Menu

The admin menu should contain cards with different features / subnavigations. These are:
- General settings: for now, this should only be the whatsapp link that can be set here. But this might extend in the future.
- Managing invitations
- A clear data button: this should delete all uploaded files and users. It should ask for extra confirmation when clicked.

### Core information sharing

- Everyone should be able to add their flight information and there should be an overview of flights. The name of the person in the overview should be clickable and show the user overlay.
- People should be able to add an accomodation and people should be able to assign themselves or beeing assigned (accept that assignment) to an accomodation. The accomodation should have a location and a start and endate plus a field for extra information. Furthermore, the accomodation should also have a number of (free) spots. The free spots are the spots minus the assigned users.
- Also add some rides in there with startingpoint and endpoint and if there are free spots in the car. In the list view of the rides, make the one offering the ride clickable and re-use the user overlay for that.
- Only show rides that are in the future and at the bottom have a symbol to click and then also show past rides blow. Sort the future rides ascending in time.

### Media sharing

- The users should be able to share images and videos in original file quality through the app with each other.
- The view showing the images should only show a thumbnail for better performance. There should be at the top right a download all button and upon click of the image a higher resolution should load with the option of downloading the single one. The thumbnail should be created upon upload and also for the videos there should be just a thumbnail with an indication that it is a video.
- For videos uploaded, also create a thumbnail for the specific video that indicates the content for the user and also overlay it with something like a video symbol that the user also knows it is a video.
- Show some uploading indication in the user interface while a file is uploaded.

### Activities

- User should be able to create an activity that they are doing if they want to give others the opportunity to join.
- An activity should consist of start time, end time (optional), a location and a title.
- As location people should be able to use their current location for ease of use.
- The user who has created the activity (and admins) can always stop an activity. Stopping puts the end time "now" in the entry.
- The list of activities should only consist of ongoing or future activities.

### Starting Page

- The starting page should contain a list of cards below each other with general information. This can be hardcoded.
- It should start with a header picture.
- Second there should be a list of open user tasks, if no open user task is there, this card should not be shown.
- Then there should be the list of training times and the location where is trained. 
- Then traveling information (nearest Airport is Malaga). This card should also include a list of people that are on the same flight to the training camp and a list of people that are on the same flight back (the flight should be not too specific here, same time (+/- 3 hours) and same airport should be considered same flight).
- The photos and videos card should show the two most recent thumbnails between the title and the link to the sharing.
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
- "Vehicles" should show the ride sharing page,
- "Activities" showing the list of activities,
- "Pictures" should show the gallery view (it should also have a number attached to the icon with the total number of pictures shared)
- "Settings" should go to the profile settings of the user,
- and if the user is an admin "Admin". Admin is for now the invites page.

The navigation should use appropriate icons and avoid text whenever possible.

### Calendar view

- There should be a calendar view in a table format. It should start with the first flight as first column and end with the last returning flight as columns. Then it should have one row per user and visualize in the fields if the user is already there and not yet returned as well as the accomodation the user is staying. The users should be sorted by arrival time (first flight).
- In the calendar view, when clicked on a user, it should open an overlay that shows the different contact options for the user, i.e., the mail adress with an icon to click on that has a mailto link, similar a phone and a whatsapp link and an instagram link.
- The day of arrival in the calendar view should be marked by a landing plane and the day of leaving by a departing one.
- Days with a confirmed accomodation should be marked in green.

### Other features

- The app should have a 'share' option to share the link to the app with someone via phone.