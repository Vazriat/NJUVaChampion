package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.CreateTeamRequest;
import com.NJUChampion.Valorant.dto.TeamApplicationVO;
import com.NJUChampion.Valorant.dto.TeamVO;
import com.NJUChampion.Valorant.entity.TeamApplication;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.service.TeamApplicationService;
import com.NJUChampion.Valorant.service.TeamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;
    private final TeamApplicationService applicationService;

    @PostMapping
    public Result<TeamVO> create(@Valid @RequestBody CreateTeamRequest req,
                                 @AuthenticationPrincipal User user) {
        TeamVO team = teamService.create(req, user.getId());
        return Result.success(team);
    }

    @GetMapping
    public Result<List<TeamVO>> list() {
        return Result.success(teamService.listAll());
    }

    @GetMapping("/my")
    public Result<TeamVO> myTeam(@AuthenticationPrincipal User user) {
        TeamVO team = teamService.getMyTeam(user.getId());
        return Result.success(team);
    }

    @GetMapping("/captain")
    public Result<List<TeamVO>> myCaptainedTeams(@AuthenticationPrincipal User user) {
        return Result.success(teamService.getMyCaptainedTeams(user.getId()));
    }

    @GetMapping("/{id}")
    public Result<TeamVO> detail(@PathVariable Long id) {
        return Result.success(teamService.getById(id));
    }

    /**
     * 提交入队申请。
     * 入队已改为队长审批制，本接口不再直接写入成员，改为创建一条 APPLY 记录并返回。
     */
    @PostMapping("/{id}/join")
    public Result<TeamApplicationVO> join(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return Result.success(applicationService.create(
                user.getId(), TeamApplication.TYPE_APPLY, id, null, null, null));
    }

    @PostMapping("/{id}/leave")
    public Result<Void> leave(@PathVariable Long id, @AuthenticationPrincipal User user) {
        teamService.leave(id, user.getId());
        return Result.success();
    }

    /** 该队的申请与邀请（含已处理），仅队长可查看 */
    @GetMapping("/{id}/applications")
    public Result<List<TeamApplicationVO>> applications(@PathVariable Long id,
                                                        @AuthenticationPrincipal User user) {
        return Result.success(applicationService.listTeamApplications(id, user.getId()));
    }

    /** 踢出队员，仅队长 */
    @DeleteMapping("/{id}/members/{userId}")
    public Result<Void> dismissMember(@PathVariable Long id,
                                      @PathVariable Long userId,
                                      @AuthenticationPrincipal User user) {
        teamService.dismissMember(id, userId, user.getId());
        return Result.success();
    }

    @GetMapping("/{id}/matches")
    public Result<List<Map<String, Object>>> getMatchHistory(@PathVariable Long id) {
        return Result.success(teamService.getMatchHistory(id));
    }
}
