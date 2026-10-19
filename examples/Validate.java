// Validate one file. Java 11+. No extra libraries.
//   javac examples/Validate.java && java -cp examples Validate samples/valid-xrechnung-ubl.xml
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

public class Validate {
    public static void main(String[] args) throws Exception {
        if (args.length != 1) {
            System.err.println("usage: java Validate FILE");
            System.exit(2);
        }
        Path path = Path.of(args[0]);
        String filename = path.getFileName().toString();
        String mediaType = filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/xml";
        String boundary = "----xrechnung" + System.currentTimeMillis();
        byte[] fileBytes = Files.readAllBytes(path);
        byte[] head = ("--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + mediaType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8);
        byte[] tail = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
        byte[] body = new byte[head.length + fileBytes.length + tail.length];
        System.arraycopy(head, 0, body, 0, head.length);
        System.arraycopy(fileBytes, 0, body, head.length, fileBytes.length);
        System.arraycopy(tail, 0, body, head.length + fileBytes.length, tail.length);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://checkxrechnung.com/v1/validate"))
                .timeout(Duration.ofSeconds(120))
                .header("Accept", "application/json")
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();
        HttpResponse<String> response = HttpClient.newHttpClient()
                .send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
        System.exit(response.statusCode() == 200 ? 0 : 1);
    }
}
