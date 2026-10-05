package com.NJUChampion.Valorant.repository;

import com.NJUChampion.Valorant.entity.RecruitmentPost;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RecruitmentPostRepository extends JpaRepository<RecruitmentPost, Long> {

    List<RecruitmentPost> findByTypeAndStatusOrderByCreatedAtDesc(String type, String status);

    List<RecruitmentPost> findByTypeAndStatusAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
            String type, String status, String keyword);

    List<RecruitmentPost> findByStatusOrderByCreatedAtDesc(String status);

    List<RecruitmentPost> findByStatusAndContentContainingIgnoreCaseOrderByCreatedAtDesc(
            String status, String keyword);

    List<RecruitmentPost> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** 个人主页用：某用户当前 OPEN 的帖子 */
    List<RecruitmentPost> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);

    /** 队伍页用：某队伍当前 OPEN 的招募帖 */
    List<RecruitmentPost> findByTeamIdAndStatusOrderByCreatedAtDesc(Long teamId, String status);

    /** 管理员视图用：不过滤状态 */
    List<RecruitmentPost> findAllByOrderByCreatedAtDesc();

    List<RecruitmentPost> findByTeamIdOrderByCreatedAtDesc(Long teamId);

    /** 同一队伍当前 OPEN 的招募帖（用于"一队一帖"约束） */
    Optional<RecruitmentPost> findFirstByTeamIdAndTypeAndStatus(Long teamId, String type, String status);

    /** 同一用户当前 OPEN 的求职帖（用于"一人一帖"约束） */
    Optional<RecruitmentPost> findFirstByUserIdAndTypeAndStatus(Long userId, String type, String status);
}
