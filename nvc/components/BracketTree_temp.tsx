"use client";

import React, { useMemo } from "react";

export interface BracketMatch {
  id: number;
  stage: string;
  round: number;
  position: number;
  team1Id: number | null;
  team1Name: string | null;
  team2Id: number | null;
  team2Name: string | null;
  winnerId: number | null;
  status: string;
  gamesPerMatch?: number;
}

interface BracketTreeProps {
  matches: BracketMatch[];
  format?: string;
  onMatchClick?: (match: BracketMatch) => void;
}
