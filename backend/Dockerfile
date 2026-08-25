# ---- 构建阶段：Maven + JDK21 ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY maven-settings.xml /root/.m2/settings.xml
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

# ---- 运行阶段：JRE21 ----
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/Valorant-0.0.1-SNAPSHOT.jar app.jar
ENV TZ=Asia/Shanghai \
    APP_UPLOAD_DIR=/app/uploads
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
