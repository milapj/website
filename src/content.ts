/**
 * All the words in the world live here so they are easy to edit without
 * touching game code. Every dialog is a list of pages; each page is shown in
 * the dialog box and advanced with SPACE / ENTER / click.
 *
 * `speaker` is the name shown in the small tab above the dialog box.
 */

export interface DialogPage {
  speaker?: string;
  text: string;
  /** Optional URL; the dialog shows a hint and O opens it in a new tab. */
  link?: string;
}

export type Dialog = DialogPage[];

import { skillDialogs } from './skills';

export const OWNER_NAME = 'Dr. Milap Jhumkhawala';
export const OWNER_EMAIL = 'milap.jhumkhawala@gmail.com';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/milap95/';

/**
 * Where the Well of Sending posts its form. Leave empty to fall back to the
 * visitor's mail app. A form-to-email service works with no server of your
 * own, e.g. Formspree: 'https://formspree.io/f/<your-form-id>'.
 */
export const WELL_ENDPOINT = 'https://formspree.io/f/xqpkvaqk';

/** Shown every time the page loads, before the player can move. */
export const INTRO_DIALOG: Dialog = [
  {
    speaker: 'Dr. Jhumkhawala',
    text: `Hello, I'm ${OWNER_NAME}, and this is my cat Myra.`,
  },
  {
    speaker: 'Dr. Jhumkhawala',
    text:
      'Welcome to my little world, inspired by the Pokemon and Zelda games I ' +
      'grew up playing. Wander around and explore to learn about me.',
  },
  {
    speaker: 'Dr. Jhumkhawala',
    text:
      'Four paths leave this cloud town. West: the dark castle of EDUCATION. ' +
      'East: the burning lands of WORK EXPERIENCE. South, down the pier: the ' +
      'sunken city of PERSONAL PROJECTS. North: the trophy room of TECHNICAL SKILLS.',
  },
  {
    speaker: 'Dr. Jhumkhawala',
    text:
      'Move with the ARROW KEYS or WASD. Face a sign or a plaque and press ' +
      'SPACE to read it. Myra will ask for treats. Press SPACE to begin!',
  },
];

/** What Myra's speech bubble says when you meet her. Cycles in order. */
export const MYRA_BUBBLES = ['Feed me?', 'Do you have any treats?'];

/**
 * Readable things. Ids are placed in the map by tools/build_map.py:
 * signs and plaques trigger when the player faces them and presses SPACE.
 */
const BASE_INTERACTIONS: Record<string, Dialog> = {
  'sign-welcome': [
    {
      speaker: 'Sign',
      text: `Welcome to ${OWNER_NAME}'s town. Four paths lead to four places. Explore them all!`,
    },
  ],
  fountain: [
    {
      speaker: 'The Well of Sending',
      text:
        'Still water that carries a voice over any distance. Cast your name ' +
        'and a way to reach you into the well, and Milap shall be told.',
    },
    {
      speaker: 'The Well of Sending',
      text:
        'Or seek him in the halls of LinkedIn: press the letter O to open ' +
        'the gate. Press SPACE to approach the water.',
      link: LINKEDIN_URL,
    },
  ],
  'dir-education': [
    { speaker: 'Sign', text: 'West bridge: the Castle of EDUCATION.' },
  ],
  'dir-work': [
    { speaker: 'Sign', text: 'East bridge: the Ashlands of WORK EXPERIENCE.' },
  ],
  'dir-projects': [
    { speaker: 'Sign', text: 'South pier: the sunken city of PERSONAL PROJECTS.' },
  ],
  'dir-skills': [
    { speaker: 'Sign', text: 'North bridge: the trophy room of TECHNICAL SKILLS.' },
  ],
  // ---------------------------------------------------------------- Education
  'sign-education': [
    {
      speaker: 'Sign',
      text: 'The Castle of EDUCATION. Three medals hang in the hall: gold, silver and bronze. Walk up to the door and it will open for you.',
    },
  ],
  'edu-1': [
    {
      speaker: 'Doctorate',
      text:
        'PhD in Information Technology, specialising in Generative AI. ' +
        'University of the Cumberlands, Williamsburg, Kentucky. 2022 to 2026.',
    },
  ],
  'edu-2': [
    {
      speaker: "Master's",
      text:
        'Master of Science in Computer Science. Illinois Institute of ' +
        'Technology, Chicago, Illinois. 2017 to 2019.',
    },
  ],
  'edu-3': [
    {
      speaker: "Bachelor's",
      text:
        "Bachelor's in Electronics and Telecommunication. NMIMS University, " +
        'Mumbai. 2012 to 2016.',
    },
  ],

  // ---------------------------------------------------------- Work Experience
  'sign-work': [
    {
      speaker: 'Sign',
      text:
        'The burning lands of WORK EXPERIENCE: the jobs I have worked and the one I ' +
        'am working now. The plaque still burning is my current job; the ashen, ' +
        'smouldering one is where I worked before.',
    },
  ],
  'work-1': [
    {
      speaker: 'Integral Ad Science',
      text:
        'Senior Software Engineer, Developer Experience. Integral Ad Science, ' +
        'Chicago. 2019 to PRESENT.',
    },
  ],
  'work-2': [
    {
      speaker: 'GetParking',
      text:
        'Software Developer, IoT and Computer Vision. GetParking, Mumbai, ' +
        'India. August 2016 to August 2017.',
    },
  ],

  // -------------------------------------------------------- Personal Projects
  'sign-projects': [
    {
      speaker: 'Sign',
      text: 'The sunken city of PERSONAL PROJECTS. Research and things I build. The ruin in the corner leads deeper, to the projects that did not go so well.',
    },
  ],
  'proj-1': [
    {
      speaker: 'PhD Dissertation',
      text:
        'Optimizing Retrieval-Augmented Generation (RAG) with an External ' +
        'Reasoning Engine for Enhanced Performance. Dissertation published ' +
        'and successfully defended.',
    },
  ],
  'proj-2': [
    {
      speaker: 'White Paper',
      text:
        'Applying Statistical Inferential Analysis to Software Incident Data. ' +
        'Press the letter O to open the paper.',
      link: 'https://milapj.github.io/infer-stats-white-paper/',
    },
  ],
  'proj-3': [
    {
      speaker: 'kube-troubleshooter',
      text:
        'A Kubernetes debugging pod toolkit: one container packed with the ' +
        'tools you need to troubleshoot a cluster from the inside. Press the ' +
        'letter O for the code.',
      link: 'https://github.com/milapj/kube-troubleshooter',
    },
  ],
  'proj-4': [
    {
      speaker: 'This Website',
      text:
        'The world you are standing in: a retro top-down game built with ' +
        'Phaser 3, Grid Engine and Time Fantasy pixel art. Press the letter O ' +
        'for the code.',
      link: 'https://github.com/milapj/website',
    },
  ],
  'proj-5': [
    {
      speaker: 'kubectl-backup-diff',
      text:
        'A kubectl plugin that backs up Kubernetes resources and diffs state ' +
        'changes, for disaster recovery and hunting down drift. Press the ' +
        'letter O for the code.',
      link: 'https://github.com/milapj/kubectl-backup-diff',
    },
  ],
  'proj-6': [
    {
      speaker: 'linux-container-engine',
      text:
        'A basic Linux container engine written in C, to learn what Docker ' +
        'really does under the hood. Press the letter O for the code.',
      link: 'https://github.com/milapj/linux-container-engine',
    },
  ],
  'proj-7': [
    {
      speaker: 'k8sgpt',
      text:
        'Active contributor to k8sgpt, the open-source project giving ' +
        'Kubernetes superpowers to everyone. Press the letter O for the project.',
      link: 'https://github.com/milapj/k8sgpt',
    },
  ],

  // ------------------------------------------------ Side projects (the vault)
  'side-1': [
    {
      speaker: 'Side Project',
      text: '<Not-so-great project #1>: <what it was, and what I learned from it>.',
    },
  ],
  'side-2': [
    {
      speaker: 'Side Project',
      text: '<Not-so-great project #2>: <what it was, and what I learned from it>.',
    },
  ],
  'side-3': [
    {
      speaker: 'Side Project',
      text: '<Not-so-great project #3>: <what it was, and what I learned from it>.',
    },
  ],

  // -------------------------------------------------------------------- Myra
  myra: [
    { speaker: 'Myra', text: 'Meow. Do you have any treats??' },
    { speaker: 'Myra', text: '...No? Then keep walking, human.' },
  ],
};

export const INTERACTIONS: Record<string, Dialog> = {
  ...BASE_INTERACTIONS,
  ...skillDialogs(),
};
