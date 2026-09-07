#!/usr/bin/env node
// Per docs/Spec.md's "Test cases" section: a script that logs in as the
// admin (credentials from .env), asks questions to add a person (or reads
// them from a previously-saved file), saves the resolved input back to a
// file for re-use, and creates the corresponding entries — user, contact
// info, both flights, accommodation — in the target system via the real
// HTTP API. See tests/README.md#add-user-script and
// docs/Architecture.md#add-user-script for the full design.
//
// Usage:
//   npm run add-user                       # interactive prompts
//   npm run add-user -- --input file.json  # non-interactive, reads file.json
//   npm run add-user -- --save file.json   # interactive, but save under this path
//
//   node --env-file=../.env scripts/add-user.js --input file.json
//
// PowerShell note: PowerShell's npm.ps1 shim drops a bare `--` before it
// reaches npm, so `npm run add-user -- --input file.json` silently falls
// back to interactive mode there (npm logs "Unknown cli config" and eats
// the flag). Quote the separator instead: npm run add-user '--' --input
// file.json — or call node directly: node --env-file=../.env
// scripts/add-user.js --input file.json (run from tests/).
//
// Requires ADMIN_EMAIL, ADMIN_PASSWORD (and optionally APP_BASE_URL,
// defaulting to http://localhost:8000) in the environment — the npm script
// loads these from the repository's root .env via --env-file.
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { ApiClient } from '../helpers/client.js';

// readline/promises' rl.question() only reliably resolves the *first* call
// when stdin isn't a TTY (piped/redirected input) — later calls hang
// forever. Consuming the interface as an async iterator instead works for
// both piped input and a real interactive terminal.
function makeAsker(rl) {
  const iterator = rl[Symbol.asyncIterator]();
  return async function ask(promptText) {
    process.stdout.write(promptText);
    const { value, done } = await iterator.next();
    return done ? '' : value;
  };
}

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:8000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function parseArgs(argv) {
  const args = { input: null, save: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input') args.input = argv[++i];
    else if (argv[i] === '--save') args.save = argv[++i];
  }
  return args;
}

function slugify(name) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'user'
  );
}

// Neither is asked interactively (not in the spec's list of questions) —
// generated so the real HTTP registration flow (which requires both) can
// still go through, and saved to the output file so a re-run is reproducible.
function generatePassword() {
  return randomBytes(9).toString('base64url');
}

function generatePlaceholderEmail(name) {
  return `${slugify(name)}+${randomBytes(4).toString('hex')}@invite.local`;
}

async function promptFlight(ask, label) {
  console.log(`\n${label}`);
  const departureAirport = await ask('  Abflughafen (IATA-Code): ');
  const arrivalAirport = await ask('  Zielflughafen (IATA-Code): ');
  const departureTime = await ask('  Abflugzeit (ISO 8601, z.B. 2026-06-01T09:00:00Z): ');
  const arrivalTime = await ask('  Ankunftszeit (optional): ');
  const airline = await ask('  Airline (optional): ');
  const flightNumber = await ask('  Flugnummer (optional): ');
  const notes = await ask('  Notizen (optional): ');
  return {
    departureAirport: departureAirport.trim(),
    arrivalAirport: arrivalAirport.trim(),
    departureTime: departureTime.trim(),
    arrivalTime: arrivalTime.trim() || undefined,
    airline: airline.trim() || undefined,
    flightNumber: flightNumber.trim() || undefined,
    notes: notes.trim() || undefined,
  };
}

// Lists existing accommodations (via the already-authenticated admin
// client — GET /api/accommodations only requires auth, not ownership) so
// the operator can pick one instead of always creating a new one.
async function promptAccommodation(ask, admin) {
  const res = await admin.get('/api/accommodations');
  const accommodations = res.body.accommodations || [];
  console.log('\nUnterkunft');
  if (accommodations.length > 0) {
    console.log('  Vorhandene Unterkünfte:');
    accommodations.forEach((a, i) => {
      const free = a.freeSpots == null ? '' : `, ${a.freeSpots} frei`;
      console.log(`   [${i + 1}] ${a.location} (${a.startDate} bis ${a.endDate}${free})`);
    });
  } else {
    console.log('  (noch keine Unterkünfte vorhanden)');
  }
  const choice = (await ask('  Nummer wählen, oder "neu" für eine neue Unterkunft: ')).trim().toLowerCase();
  if (choice !== 'neu' && choice !== '') {
    const accommodation = accommodations[Number(choice) - 1];
    if (accommodation) return { mode: 'existing', id: accommodation.id };
    console.log('  Ungültige Auswahl — es wird stattdessen eine neue Unterkunft angelegt.');
  }

  const location = await ask('  Ort: ');
  const startDate = await ask('  Anreisedatum (YYYY-MM-DD): ');
  const endDate = await ask('  Abreisedatum (YYYY-MM-DD): ');
  const spots = await ask('  Anzahl Plätze: ');
  const notes = await ask('  Notizen (optional): ');
  return {
    mode: 'new',
    location: location.trim(),
    startDate: startDate.trim(),
    endDate: endDate.trim(),
    spots: Number(spots.trim()),
    notes: notes.trim() || undefined,
  };
}

async function collectInputInteractively(admin) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  const ask = makeAsker(rl);
  try {
    const name = await ask('Name: ');
    const email = await ask('E-Mail (optional): ');
    const phone = await ask('Telefon (optional): ');
    const instagramHandle = await ask('Instagram-Handle (optional): ');
    const arrivalFlight = await promptFlight(ask, 'Hinflug (Ankunft im Camp)');
    const departureFlight = await promptFlight(ask, 'Rückflug (Abreise vom Camp)');
    const accommodation = await promptAccommodation(ask, admin);
    return {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      instagramHandle: instagramHandle.trim() || undefined,
      arrivalFlight,
      departureFlight,
      accommodation,
    };
  } finally {
    rl.close();
  }
}

function validateInput(input) {
  const errors = [];
  if (!input.name) errors.push('name is required');
  for (const key of ['arrivalFlight', 'departureFlight']) {
    const f = input[key];
    if (!f || !f.departureAirport || !f.arrivalAirport || !f.departureTime) {
      errors.push(`${key}.departureAirport, ${key}.arrivalAirport and ${key}.departureTime are required`);
    }
  }
  const acc = input.accommodation;
  if (!acc || (acc.mode !== 'existing' && acc.mode !== 'new')) {
    errors.push('accommodation.mode must be "existing" or "new"');
  } else if (acc.mode === 'existing' && !acc.id) {
    errors.push('accommodation.id is required when accommodation.mode is "existing"');
  } else if (acc.mode === 'new' && (!acc.location || !acc.startDate || !acc.endDate || !acc.spots)) {
    errors.push('accommodation.location, startDate, endDate and spots are required when accommodation.mode is "new"');
  }
  if (errors.length) throw new Error(`Invalid input:\n  - ${errors.join('\n  - ')}`);
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set (see .env) — this script logs in as the admin to create the invite.'
    );
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const admin = new ApiClient(BASE_URL);
  const loginRes = await admin.post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (loginRes.status !== 200) {
    console.error(`Admin login failed (${loginRes.status}):`, loginRes.body);
    process.exit(1);
  }
  console.log(`Logged in as admin ${ADMIN_EMAIL} at ${BASE_URL}`);

  const input = args.input ? JSON.parse(await readFile(args.input, 'utf8')) : await collectInputInteractively(admin);

  if (!input.email) input.email = generatePlaceholderEmail(input.name);
  if (!input.password) input.password = generatePassword();
  validateInput(input);

  const savePath =
    args.save || args.input || path.join('scripts', 'output', `${slugify(input.name)}-${Date.now()}.json`);
  await mkdir(path.dirname(savePath), { recursive: true });
  await writeFile(savePath, JSON.stringify(input, null, 2));
  console.log(`Saved input to ${savePath} (re-run with --input ${savePath})`);

  const inviteRes = await admin.post('/api/auth/invites', { name: input.name });
  if (inviteRes.status !== 201) {
    console.error(`Creating the invite failed (${inviteRes.status}):`, inviteRes.body);
    process.exit(1);
  }

  const newUser = new ApiClient(BASE_URL);
  const registerRes = await newUser.post('/api/auth/register', {
    token: inviteRes.body.token,
    name: input.name,
    email: input.email,
    password: input.password,
  });
  if (registerRes.status !== 201) {
    console.error(`Registration failed (${registerRes.status}):`, registerRes.body);
    process.exit(1);
  }
  console.log(`Created user "${input.name}" <${input.email}> (id ${registerRes.body.user.id})`);

  if (input.phone || input.instagramHandle) {
    const formData = new FormData();
    if (input.phone) formData.set('phone', input.phone);
    if (input.instagramHandle) formData.set('instagramHandle', input.instagramHandle);
    const profileRes = await newUser.request('PATCH', '/api/profile', { formData });
    if (profileRes.status !== 200) {
      console.error(`Updating contact info failed (${profileRes.status}):`, profileRes.body);
    } else {
      console.log('Updated contact info (phone/Instagram).');
    }
  }

  for (const [label, flight] of [
    ['Hinflug', input.arrivalFlight],
    ['Rückflug', input.departureFlight],
  ]) {
    const flightRes = await newUser.post('/api/flights', flight);
    if (flightRes.status !== 201) {
      console.error(`Adding ${label} failed (${flightRes.status}):`, flightRes.body);
    } else {
      console.log(`Added ${label}: ${flight.departureAirport} → ${flight.arrivalAirport}`);
    }
  }

  const acc = input.accommodation;
  let accommodationId = acc.id;
  if (acc.mode === 'new') {
    const createRes = await newUser.post('/api/accommodations', {
      location: acc.location,
      startDate: acc.startDate,
      endDate: acc.endDate,
      spots: acc.spots,
      notes: acc.notes,
    });
    if (createRes.status !== 201) {
      console.error(`Creating the accommodation failed (${createRes.status}):`, createRes.body);
    } else {
      accommodationId = createRes.body.accommodation.id;
      console.log(`Created accommodation "${acc.location}".`);
    }
  }
  if (accommodationId) {
    const assignRes = await newUser.post(`/api/accommodations/${accommodationId}/assign`, {});
    if (assignRes.status !== 201 && assignRes.status !== 409) {
      console.error(`Assigning to the accommodation failed (${assignRes.status}):`, assignRes.body);
    } else {
      console.log('Assigned to the accommodation.');
    }
  }

  console.log(`\nDone. Login for "${input.name}": ${input.email} / ${input.password}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
