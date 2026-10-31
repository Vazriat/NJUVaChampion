package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.TeamApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TeamApplicationRepository extends JpaRepository<TeamApplication, Long> {

    /** 队员当前待处理的申请（用于"同时只能申请一支战队"约束） */
    Optional<TeamApplication> findFirstByInitiatorUserIdAndTypeAndStatus(
            Long initiatorUserId, String type, String status);

    /** 同一（用户, 队伍）组合当前待处理的记录（不分 type） */
    Optional<TeamApplication> findFirstByTeamIdAndTargetUserIdAndStatus(
            Long teamId, Long targetUserId, String status);

    List<TeamApplication> findByTargetUserIdOrderByCreatedAtDesc(Long targetUserId);

    List<TeamApplication> findByInitiatorUserIdOrderByCreatedAtDesc(Long initiatorUserId);

    List<TeamApplication> findByTeamIdAndStatusOrderByCreatedAtDesc(Long teamId, String status);

    /** 该队伍的全部申请与邀请（含已处理），用于战队页队长视图 */
    List<TeamApplication> findByTeamIdOrderByCreatedAtDesc(Long teamId);

    /** 该用户作为发起方的待处理记录 */
    List<TeamApplication> findByInitiatorUserIdAndStatus(Long initiatorUserId, String status);

    /** 该用户作为接收方的待处理记录 */
    List<TeamApplication> findByTargetUserIdAndStatus(Long targetUserId, String status);

    List<TeamApplication> findByPostId(Long postId);
}
