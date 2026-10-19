// Validate one file with HttpClient. No extra packages. .NET 6+.
//   dotnet new console -n XrechnungCheck
//   copy this file over Program.cs, then: dotnet run -- path/to/invoice.xml
using System.Net.Http.Headers;

if (args.Length != 1)
{
    Console.Error.WriteLine("usage: XrechnungCheck FILE");
    return 2;
}

var path = args[0];
var mediaType = path.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)
    ? "application/pdf"
    : "application/xml";

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
using var form = new MultipartFormDataContent();
await using var stream = File.OpenRead(path);
using var file = new StreamContent(stream);
file.Headers.ContentType = new MediaTypeHeaderValue(mediaType);
form.Add(file, "file", Path.GetFileName(path));

using var response = await http.PostAsync("https://checkxrechnung.com/v1/validate", form);
var body = await response.Content.ReadAsStringAsync();
Console.WriteLine(body);
return response.IsSuccessStatusCode ? 0 : 1;
