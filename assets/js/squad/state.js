// Squad State Management Module
import { supabase } from '../supabaseClient.js';
import { getSWR, setCache, getCache } from '../utils.js';
import { generateAvatar } from '../avatars.js';
import { createSquadLevelBadge, createSquadLevelProgress, getSquadLevelBorderStyle } from '../level-badge.js';
import { ACADEMIC_YEARS, DEPARTMENTS } from '../constants.js';

// Global State Variables
export let currentSquad = null;
export let currentProfile = null;
export let currentMemberRole = 'member';
export let userResults = [];
export let globalSquadSettings = {
    join_mins: null,
    grace_mins: null,
    max_members: null,
    success_threshold: null
};

// UI State
export const views = {
    loading: document.getElementById('loadingView'),
    noSquad: document.getElementById('noSquadView'),
    mainSquad: document.getElementById('mainSquadView')
};

// Presence & Realtime
export let presenceChannel = null;
export let onlineUsersSet = new Set();

// Challenge State
export let challengeTimerInterval = null;

// Pomodoro State (MUST BE let, NOT const)
export let pomodoroInterval = null;
export let pomodoroEnd = null;
export let lastPomState = null;

// Chat State
export let readQueue = [];
export let readTimeout = null;

// Exam Timers
export let examTimers = {};

// Sync State
export let syncTimer = null;

// State Setters
export function setCurrentSquad(squad) {
    currentSquad = squad;
}

export function setCurrentProfile(profile) {
    currentProfile = profile;
}

export function setCurrentMemberRole(role) {
    currentMemberRole = role || 'member';
}

export function setUserResults(results) {
    userResults = results;
}

export function setGlobalSquadSettings(settings) {
    if (settings.join_mins !== undefined) globalSquadSettings.join_mins = Number(settings.join_mins);
    if (settings.grace_mins !== undefined) globalSquadSettings.grace_mins = Number(settings.grace_mins);
    if (settings.max_members !== undefined) globalSquadSettings.max_members = Number(settings.max_members);
    if (settings.success_threshold !== undefined) globalSquadSettings.success_threshold = Number(settings.success_threshold);
}

export function setPresenceChannel(channel) {
    presenceChannel = channel;
}

export function setOnlineUsersSet(set) {
    onlineUsersSet = set;
}

export function setChallengeTimerInterval(interval) {
    challengeTimerInterval = interval;
}

export function setPomodoroInterval(interval) {
    pomodoroInterval = interval;
}

export function setPomodoroEnd(end) {
    pomodoroEnd = end;
}

export function setLastPomState(state) {
    lastPomState = state;
}

export function setSyncTimer(timer) {
    syncTimer = timer;
}
