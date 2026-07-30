package com.NJUChampion.Valorant.controller;

import com.NJUChampion.Valorant.common.Result;
import com.NJUChampion.Valorant.dto.UserVO;
import com.NJUChampion.Valorant.entity.User;
import com.NJUChampion.Valorant.repository.UserRepository;
import com.NJUChampion.Valorant.entity.Team;
import com.NJUChampion.Valorant.entity.TeamMember;
import com.NJUChampion.Valorant.repository.TeamMemberRepository;
import com.NJUChampion.Valorant.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class PublicUserController {

    private final UserRepository userRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TeamRepository teamRepository;

    @GetMapping
    public Result<List<UserVO>> list() {
        List<User> users = userRepository.findAll().stream()
                .filter(u -> !"ADMIN".equals(u.getRole())) // 管理员不公开
                .collect(Collectors.toList());
        List<UserVO> vos = users.stream().map(this::toVO).collect(Collectors.toList());
        return Result.success(vos);
    }

    @GetMapping("/{id}")
    public Result<UserVO> detail(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if ("ADMIN".equals(user.getRole())) {
            throw new IllegalArgumentException("用户不存在");
        }
        return Result.success(toVO(user));
    }

    private UserVO toVO(User user) {
        UserVO.UserVOBuilder builder = UserVO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .gameId(user.getGameId())
                .displayGameId(user.getDisplayGameId())
                .role(user.getRole())
                .status(user.getStatus())
                .contact(user.getContactPublic() != null && user.getContactPublic() ? user.getContact() : null)
                .contactPublic(user.getContactPublic())
                .verifiedType(user.getVerifiedType())
                .verifiedRank(user.getRankPublic() != null && user.getRankPublic() ? user.getVerifiedRank() : null)
                .rankPublic(user.getRankPublic())
                .displayPreference(user.getDisplayPreference())
                .createdAt(user.getCreatedAt());

        List<TeamMember> memberships = teamMemberRepository.findByUserId(user.getId());
        if (!memberships.isEmpty()) {
            TeamMember tm = memberships.get(0);
            Team team = teamRepository.findById(tm.getTeamId()).orElse(null);
            if (team != null) {
                builder.team(new UserVO.TeamInfo(team.getId(), team.getName(), tm.getRole()));
            }
        }

        return builder.build();
    }
}