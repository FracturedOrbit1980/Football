"use client";

import { create } from "zustand";

import {
  DEFAULT_CLUB_ID,
  clubDataKey,
  normalizePaymentDetails,
  readRegistry,
  writeRegistry,
  type ClubInput,
  type ClubProfile,
} from "@/lib/club/registry";
import { loadClubData, useClubStore } from "@/stores/club-store";

interface LibraryState {
  clubs: ClubProfile[];
  activeId: string | null;
  ready: boolean;
  refresh: () => void;
  load: (id: string) => Promise<void>;
  addClub: (input: ClubInput) => Promise<void>;
  updateClub: (id: string, input: ClubInput) => void;
  deleteClub: (id: string) => void;
}

function save(clubs: ClubProfile[], activeId: string | null) {
  writeRegistry({ clubs, activeId });
}

export const useClubLibrary = create<LibraryState>((set, get) => ({
  clubs: [],
  activeId: null,
  ready: false,
  refresh: () => {
    const registry = readRegistry();
    set({ clubs: registry.clubs, activeId: registry.activeId, ready: true });
  },
  load: async (id) => {
    const club = get().clubs.find((item) => item.id === id);
    if (!club) return;
    if (get().activeId === id) {
      if (!useClubStore.getState().hydrated) void loadClubData(id, club.kind);
      return;
    }
    useClubStore.setState({ hydrated: false });
    save(get().clubs, id);
    set({ activeId: id });
  },
  addClub: async (input) => {
    const name = input.name.trim();
    if (!name) return;
    const club: ClubProfile = {
      id: `club-${Date.now()}`,
      name,
      logo: input.logo,
      theme: input.theme,
      kind: "custom",
      ...normalizePaymentDetails(input),
    };
    const clubs = [...get().clubs, club];
    useClubStore.setState({ hydrated: false });
    save(clubs, club.id);
    set({ clubs, activeId: club.id });
  },
  updateClub: (id, input) => {
    const name = input.name.trim();
    if (!name) return;
    const clubs = get().clubs.map((club) =>
      club.id === id
        ? { ...club, name, logo: input.logo, theme: input.theme, ...normalizePaymentDetails(input) }
        : club,
    );
    save(clubs, get().activeId);
    set({ clubs });
  },
  deleteClub: (id) => {
    if (id === DEFAULT_CLUB_ID) return;
    const clubs = get().clubs.filter((club) => club.id !== id);
    const wasActive = get().activeId === id;
    if (wasActive) {
      // The store writes to whichever key it points at, so detach it before clearing or the
      // deleted club's data is immediately written back.
      useClubStore.persist.setOptions({ name: "bnfc-club-pending" });
      useClubStore.setState({ hydrated: false });
    }
    localStorage.removeItem(clubDataKey(id));
    save(clubs, wasActive ? null : get().activeId);
    set(wasActive ? { clubs, activeId: null } : { clubs });
  },
}));

export function activeClub(clubs: ClubProfile[], activeId: string | null) {
  return clubs.find((club) => club.id === activeId) ?? null;
}
