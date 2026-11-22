import { stdin, stdout } from 'node:process';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.js';
import { AdminSeat, User } from '../lib/models.js';
import { hashPassword } from '../lib/auth.js';
import {
  ADMIN_ROLE,
  ADMIN_ROLE_VALUES,
  SUPER_ADMIN_ROLE
} from '../shared/roles.js';

const ADMIN_SEAT_LIMIT = 11;

if (!process.env.MONGODB_URI?.trim() && !process.env.MONGO_URI?.trim()) {
  throw new Error('Set MONGODB_URI or MONGO_URI before provisioning an administrator.');
}
if (!stdin.isTTY) {
  throw new Error('Run this command from an interactive terminal so the password can be entered securely.');
}

stdout.write('Seat 1 is reserved for SuperAdmin; seats 2-11 are for Admin accounts.\n');
if (!await dbConnect()) throw new Error('Could not connect to MongoDB.');
if (await User.countDocuments({ role: { $in: ADMIN_ROLE_VALUES } }) >= ADMIN_SEAT_LIMIT) {
  throw new Error('The limit of one SuperAdmin and ten Admin accounts has been reached.');
}

if (!await AdminSeat.exists({ _id: 1 })) {
  const configuredEmail = String(process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .find(Boolean);
  let existingPrimary = await User.findOne({ role: SUPER_ADMIN_ROLE })
    .sort({ createdAt: 1, _id: 1 }).select('email').lean();
  if (!existingPrimary && configuredEmail) {
    existingPrimary = await User.findOne({
      role: { $in: ADMIN_ROLE_VALUES },
      email: configuredEmail
    }).select('email').lean();
  }
  if (!existingPrimary) {
    existingPrimary = await User.findOne({
      role: { $in: ADMIN_ROLE_VALUES },
      status: 'সুপার এডমিন'
    }).sort({ createdAt: 1, _id: 1 }).select('email').lean();
  }
  if (existingPrimary) await AdminSeat.create({ _id: 1, email: existingPrimary.email });
}

function ask(prompt) {
  return new Promise((resolve) => {
    stdout.write(prompt);
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (key) => {
      if (key === '\u0003') {
        stdin.setRawMode(false);
        stdin.off('data', onData);
        process.exit(130);
      }
      if (key === '\r' || key === '\n') {
        stdin.setRawMode(false);
        stdin.off('data', onData);
        stdout.write('\n');
        resolve(value);
        return;
      }
      if (key === '\u007f' || key === '\b') {
        value = value.slice(0, -1);
        return;
      }
      value += key;
      stdout.write('*');
    };
    stdin.on('data', onData);
  });
}

let reservedSeat;
let createdUser;
try {
  stdout.write('Account name: ');
  const name = await new Promise((resolve) => {
    let value = '';
    stdin.setEncoding('utf8');
    stdin.once('data', (input) => {
      value = input.trim();
      resolve(value);
    });
  });
  stdout.write('Account email: ');
  const email = await new Promise((resolve) => {
    stdin.once('data', (input) => resolve(input.trim().toLowerCase()));
  });
  const password = await ask('Password (minimum 10 characters): ');
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) {
    throw new Error('Enter a name, valid email, and a password of at least 10 characters.');
  }

  for (let seat = 1; seat <= ADMIN_SEAT_LIMIT; seat += 1) {
    try {
      reservedSeat = await AdminSeat.create({ _id: seat, email });
      break;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  if (!reservedSeat) throw new Error('The limit of one SuperAdmin and ten Admin accounts has been reached.');

  const role = reservedSeat._id === 1 ? SUPER_ADMIN_ROLE : ADMIN_ROLE;
  createdUser = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role,
    status: 'active'
  });
  console.log(`${role} account ${email} created. ${ADMIN_SEAT_LIMIT - reservedSeat._id} account slot(s) remain.`);
} catch (error) {
  if (reservedSeat && !createdUser) await AdminSeat.deleteOne({ _id: reservedSeat._id });
  throw error;
} finally {
  if (stdin.isTTY) stdin.setRawMode(false);
  stdin.pause();
  await mongoose.disconnect();
}
