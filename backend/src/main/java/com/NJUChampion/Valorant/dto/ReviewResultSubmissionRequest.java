package com.NJUChampion.Valorant.dto;

import lombok.Data;

import java.util.List;

/** 管理员审核请求：reviewNote 为审核意见，其余字段为"修正后的完整赛果"（缺省使用申报原稿） */
@Data
public class ReviewResultSubmissionRequest {
    private String reviewNote;
    private Integer boType;
    private Integer team1Wins;
    private Integer team2Wins;
    private String note;
    private List<CreateResultSubmissionRequest.GameItem> games;
}
