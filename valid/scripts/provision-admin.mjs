import { stdin, stdout } from 'node:process';
import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.js';
import { AdminSeat, User } from '../lib/models.js';
import { hashPassword } from '../lib/auth.js';

if (!process.env.MONGODB_URI?.trim() && !process.env.MONGO_URI?.trim()) {
  throw new Error('Set MONGODB_URI or MONGO_URI before provisioning an administrator.');
}
if (!stdin.isTTY) {
  throw new Error('Run this command from an interactive terminal so the password can be entered securely.');
}

if (!await dbConnect()) throw new Error('Could not connect to MongoDB.');
if (await User.countDocuments({ role: 'admin' }) >= 2) {
  throw new Error('The maximum of two administrator accounts has already been reached.');
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
  stdout.write('Admin name: ');
  const name = await new Promise((resolve) => {
    let value = '';
    stdin.setEncoding('utf8');
    stdin.once('data', (input) => {
      value = input.trim();
      resolve(value);
    });
  });
  stdout.write('Admin email: ');
  const email = await new Promise((resolve) => {
    stdin.once('data', (input) => resolve(input.trim().toLowerCase()));
  });
  const password = await ask('Password (minimum 10 characters): ');
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) {
    throw new Error('Enter a name, valid email, and a password of at least 10 characters.');
  }

  for (const seat of [1, 2]) {
    try {
      reservedSeat = await AdminSeat.create({ _id: seat, email });
      break;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  if (!reservedSeat) throw new Error('The maximum of two administrator accounts has already been reached.');

  createdUser = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: 'admin',
    status: 'active'
  });
  console.log(`Administrator ${email} created. ${2 - reservedSeat._id} administrator slot(s) remain.`);
} catch (error) {
  if (reservedSeat && !createdUser) await AdminSeat.deleteOne({ _id: reservedSeat._id });
  throw error;
} finally {
  if (stdin.isTTY) stdin.setRawMode(false);
  stdin.pause();
  await mongoose.disconnect();
}
