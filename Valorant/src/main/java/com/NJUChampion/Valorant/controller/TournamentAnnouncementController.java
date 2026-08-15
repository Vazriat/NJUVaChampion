package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.TournamentAnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class TournamentAnnouncementController {

    private final TournamentAnnouncementService tournamentAnnouncementService;

    @GetMapping("/api/tournaments/{tournamentId}/announcements")
    public Result<List<Map<String, Object>>> listPublished(@PathVariable Long tournamentId) {
        return Result.success(tournamentAnnouncementService.listPublishedWithTournamentName(tournamentId));
    }

    @GetMapping("/api/tournament-notifications/my")
    public Result<List<Map<String, Object>>> myNotifications(@AuthenticationPrincipal User user) {
        return Result.success(tournamentAnnouncementService.listMyPublished(user.getId()));
    }
}
