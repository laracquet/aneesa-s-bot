import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3,
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};


const CREATE_TEAM_CHANNEL_COMMAND = {
  name: 'create-team-channel',
  description: 'Create a channel under the Teams category',
  options: [
    {
      type: 3,          // STRING
      name: 'channel_name',
      description: 'Name for the new channel',
      required: true,
    },
    {
      type: 6,          // USER type — allows @mentioning users
      name: 'person_1',
      description: 'First person to add to the channel',
      required: true,
    },
    {
      type: 6,          // USER type
      name: 'person_2',
      description: 'Second person to add to the channel',
      required: false,  // optional
    },
    {
      type: 6,
      name: 'person_3',
      description: 'Third person to add to the channel',
      required: false,
    },
    {
      type: 6,
      name: 'person_4',
      description: 'Fourth person to add to the channel',
      required: false,
    },    
    {
      type: 6,
      name: 'person_5',
      description: 'fifth person to add to the channel',
      required: false,
    },
    {
      type: 6,
      name: 'person_5',
      description: 'Fifth person to add to the channel',
      required: false,
    },
  ],
  type: 1,
  integration_types: [0],
  contexts: [0],
};
const ALL_COMMANDS = [TEST_COMMAND, CHALLENGE_COMMAND, CREATE_TEAM_CHANNEL_COMMAND];
InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
