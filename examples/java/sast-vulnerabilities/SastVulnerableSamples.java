/**
 * Intentionally vulnerable Java snippets for local guardrails / SAST rule demos.
 *
 * Each marked line is designed to trigger one or more {@code sast-*} rules when scanned:
 *
 *   npm run build
 *   node dist/src/cli.js scan --only code --paths examples/java/sast-vulnerabilities/
 *
 * This file is not compiled; it exists only as scan input for {@code codefence scan --only code}.
 */
public class SastVulnerableSamples {

    // --- SQL injection ---

    // sast-sql-injection-jdbc-template
    void jdbcTemplateSqlInjection(org.springframework.jdbc.core.JdbcTemplate jdbcTemplate, String userId) {
        jdbcTemplate.queryForList("SELECT * FROM users WHERE id='" + userId + "'");
    }

    // sast-sql-injection-jdbc-statement
    void jdbcStatementSqlInjection(java.sql.Statement st, String id) throws java.sql.SQLException {
        st.executeQuery("SELECT * FROM users WHERE id='" + id + "'");
    }

    // sast-sql-injection-hibernate-native-query
    void hibernateNativeQuerySqlInjection(org.hibernate.Session session, String id) {
        session.createNativeQuery("SELECT * FROM users WHERE id='" + id + "'");
    }

    // sast-sql-injection-hibernate-hql
    void hibernateHqlSqlInjection(org.hibernate.Session session, String name) {
        session.createQuery("FROM User WHERE name='" + name + "'");
    }

    // sast-sql-injection-jpa-create-native-query
    void jpaNativeQuerySqlInjection(jakarta.persistence.EntityManager em, String id) {
        em.createNativeQuery("SELECT * FROM users WHERE id='" + id + "'");
    }

    // sast-sql-injection-jpa-create-query
    void jpaJpqlSqlInjection(jakarta.persistence.EntityManager em, String name) {
        em.createQuery("SELECT u FROM User u WHERE u.name='" + name + "'");
    }

    // --- SQL injection via variables assigned on prior lines (sliding window) ---

    void jdbcTemplateSqlInjectionViaVariable(
            org.springframework.jdbc.core.JdbcTemplate jdbcTemplate,
            String userId,
            org.springframework.jdbc.core.RowMapper<?> mapper) {
        String sql = "SELECT * FROM users WHERE id='" + userId + "'";
        jdbcTemplate.query(sql, mapper);
    }

    void jdbcStatementSqlInjectionViaVariable(java.sql.Statement st, String id) throws java.sql.SQLException {
        String query = "SELECT * FROM users WHERE id='" + id + "'";
        st.executeQuery(query);
    }

    void hibernateNativeQuerySqlInjectionViaVariable(org.hibernate.Session session, String id) {
        String sql = "SELECT * FROM users WHERE id='" + id + "'";
        session.createNativeQuery(sql);
    }

    void hibernateHqlSqlInjectionViaVariable(org.hibernate.Session session, String name) {
        String hql = "FROM User WHERE name='" + name + "'";
        session.createQuery(hql);
    }

    void jpaNativeQuerySqlInjectionViaVariable(jakarta.persistence.EntityManager em, String id) {
        String sql = "SELECT * FROM users WHERE id='" + id + "'";
        em.createNativeQuery(sql);
    }

    void jpaJpqlSqlInjectionViaVariable(jakarta.persistence.EntityManager em, String name) {
        String jpql = "SELECT u FROM User u WHERE u.name='" + name + "'";
        em.createQuery(jpql);
    }

    // --- XML / XXE ---

    // sast-xxe-document-builder-factory
    void documentBuilderFactoryXxe() throws javax.xml.parsers.ParserConfigurationException {
        javax.xml.parsers.DocumentBuilderFactory dbf = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        dbf.newDocumentBuilder();
    }

    // sast-xxe-transformer-factory
    void transformerFactoryXxe() throws javax.xml.transform.TransformerConfigurationException {
        javax.xml.transform.TransformerFactory tf = javax.xml.transform.TransformerFactory.newInstance();
        tf.newTransformer();
    }

    // --- JSON injection ---

    // sast-json-injection-jackson-write-raw
    void jacksonWriteRaw(com.fasterxml.jackson.core.JsonGenerator generator, String userInput) throws java.io.IOException {
        generator.writeRaw("\"value\": " + userInput);
    }

    // --- Insecure randomness ---

    // sast-insecure-randomness-java-util-random
    java.util.Random insecureRandom() {
        return new java.util.Random();
    }

    // sast-insecure-randomness-secure-random-constant-seed
    void secureRandomConstantSeed() {
        new SecureRandom(1234L);
    }

    // --- Cookie security (Cookie constructor triggers both HttpOnly and Secure rules) ---

    // sast-cookie-security-httponly-not-set + sast-cookie-security-secure-not-set
    // Sast IDs: A76D8534, DFEEFEE0
    jakarta.servlet.http.Cookie cookieWithoutFlags(String sessionId) {
        return new jakarta.servlet.http.Cookie("session", sessionId);
    }

    // sast-cookie-security-httponly-not-set
    void cookieHttpOnlyDisabled(jakarta.servlet.http.Cookie cookie) {
        cookie.setHttpOnly(false);
    }

    // sast-cookie-security-secure-not-set
    void cookieSecureDisabled(jakarta.servlet.http.Cookie cookie) {
        cookie.setSecure(false);
    }

    // --- Hardened counterparts (should not be reported) ---

    void documentBuilderFactoryHardened() throws javax.xml.parsers.ParserConfigurationException {
        javax.xml.parsers.DocumentBuilderFactory dbf =
                javax.xml.parsers.DocumentBuilderFactory.newInstance();
        dbf.setExpandEntityReferences(false);
        dbf.newDocumentBuilder();
    }

    void transformerFactoryHardened() throws javax.xml.transform.TransformerConfigurationException {
        javax.xml.transform.TransformerFactory tf = javax.xml.transform.TransformerFactory.newInstance();
        tf.setFeature(javax.xml.XMLConstants.FEATURE_SECURE_PROCESSING, true);
        tf.newTransformer();
    }

    void cookieFlagsHardened(String sessionId) {
        jakarta.servlet.http.Cookie session = new jakarta.servlet.http.Cookie("session", sessionId);
        session.setHttpOnly(true);
        session.setSecure(true);
    }

    // --- Spring Security CSP ---

    // sast-missing-csp-spring-security
    protected void configure(org.springframework.security.config.annotation.web.builders.HttpSecurity http)
            throws Exception {
        http.authorizeHttpRequests(auth -> auth.anyRequest().authenticated());
    }
}
