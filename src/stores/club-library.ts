"use client";

import { create } from "zustand";

import { readRegistry, writeRegistry, type ClubProfile } from "@/lib/club/registry";
import type { ClubThemeId } from "@/lib/club/themes";
import { loadClubData, useClubStore } from "@/stores/club-store";

interface LibraryState {
  clubs: ClubProfile[];
  activeId: string | null;
  ready: boolean;
  refresh: () => void;
  load: (id: string) => Promise<void>;
  addClub: (input: { name: string; logo: string; theme: ClubThemeId }) => Promise<void>;
  updateClub: (id: string, input: { name: string; logo: string; theme: ClubThemeId }) => void;
  /** Club mode: a separate on-device workspace per cloud club, so clubs never share local data. */
  openCloudWorkspace: (cloudClubId: string, name: string) => Promise<void>;
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
    };
    const clubs = [...get().clubs, club];
    useClubStore.setState({ hydrated: false });
    save(clubs, club.id);
    set({ clubs, activeId: club.id });
  },
  openCloudWorkspace: async (cloudClubId, name) => {
    const id = `cloud-${cloudClubId}`;
    if (!get().clubs.some((club) => club.id === id)) {
      const clubs = [...get().clubs, { id, name: name || "Club", logo: "", theme: "red" as ClubThemeId, kind: "custom" as const }];
      save(clubs, get().activeId);
      set({ clubs });
    }
    await get().load(id);
  },
  updateClub: (id, input) => {
    const name = input.name.trim();
    if (!name) return;
    const clubs = get().clubs.map((club) =>
      club.id === id ? { ...club, name, logo: input.logo, theme: input.theme } : club,
    );
    save(clubs, get().activeId);
    set({ clubs });
  },
}));

export function activeClub(clubs: ClubProfile[], activeId: string | null) {
  return clubs.find((club) => club.id === activeId) ?? null;
}
