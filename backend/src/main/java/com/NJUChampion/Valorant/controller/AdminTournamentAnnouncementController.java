package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.entity.TournamentAnnouncement;
import com.NJUChampion.Valorant.service.TournamentAnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/tournaments/{tournamentId}/announcements")
@RequiredArgsConstructor
public class AdminTournamentAnnouncementController {

    private final TournamentAnnouncementService tournamentAnnouncementService;

    @GetMapping
    public Result<List<TournamentAnnouncement>> list(@PathVariable Long tournamentId) {
        return Result.success(tournamentAnnouncementService.listByTournament(tournamentId));
    }

    @PostMapping
    public Result<TournamentAnnouncement> create(@PathVariable Long tournamentId,
                                                 @RequestBody TournamentAnnouncement announcement) {
        announcement.setId(null);
        announcement.setTournamentId(tournamentId);
        if (announcement.getStatus() == null) {
            announcement.setStatus("DRAFT");
        }
        return Result.success(tournamentAnnouncementService.save(announcement));
    }

    @PutMapping("/{id}")
    public Result<TournamentAnnouncement> update(@PathVariable Long tournamentId,
                                                 @PathVariable Long id,
                                                 @RequestBody TournamentAnnouncement announcement) {
        announcement.setId(id);
        announcement.setTournamentId(tournamentId);
        return Result.success(tournamentAnnouncementService.save(announcement));
    }

    @PostMapping("/{id}/publish")
    public Result<TournamentAnnouncement> publish(@PathVariable Long tournamentId,
                                                  @PathVariable Long id) {
        return Result.success(tournamentAnnouncementService.publish(id));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long tournamentId,
                               @PathVariable Long id) {
        tournamentAnnouncementService.delete(id);
        return Result.success();
    }
}
