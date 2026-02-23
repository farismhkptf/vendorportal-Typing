let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

const folderIdCache = new Map<string, string>();

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const accountDomain = process.env.ZOHO_ACCOUNT_DOMAIN || "https://accounts.zoho.com";

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Zoho WorkDrive credentials not configured");
  }

  const response = await fetch(`${accountDomain}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json() as any;

  if (data.error) {
    throw new Error(`Zoho token refresh failed: ${data.error}`);
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedAccessToken!;
}

async function workdriveRequest(
  method: string,
  endpoint: string,
  body?: any,
): Promise<any> {
  const token = await getAccessToken();
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const url = `${apiDomain}/workdrive/api/v1${endpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${token}`,
  };

  let requestBody: any = undefined;

  if (body) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: requestBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho WorkDrive API error (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function listSubfolders(parentFolderId: string): Promise<Array<{ id: string; name: string }>> {
  const data = await workdriveRequest("GET", `/files/${parentFolderId}/files?filter[type]=folder`);
  if (!data?.data) return [];
  return data.data.map((item: any) => ({
    id: item.id,
    name: item.attributes?.name || "",
  }));
}

async function createFolder(parentFolderId: string, folderName: string): Promise<string> {
  const data = await workdriveRequest("POST", "/files", {
    data: {
      type: "files",
      attributes: {
        name: folderName,
        parent_id: parentFolderId,
      },
    },
  });

  if (!data?.data?.id) {
    throw new Error("Failed to create folder in Zoho WorkDrive");
  }

  return data.data.id;
}

async function getOrCreateFolder(parentFolderId: string, folderName: string): Promise<string> {
  const cacheKey = `${parentFolderId}/${folderName}`;
  if (folderIdCache.has(cacheKey)) {
    return folderIdCache.get(cacheKey)!;
  }

  const subfolders = await listSubfolders(parentFolderId);
  const existing = subfolders.find(
    (f) => f.name.toLowerCase() === folderName.toLowerCase()
  );

  if (existing) {
    folderIdCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const newFolderId = await createFolder(parentFolderId, folderName);
  folderIdCache.set(cacheKey, newFolderId);
  return newFolderId;
}

function sanitizeFolderName(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100) || "Unnamed";
}

export async function getApplicantFolderId(
  companyName: string,
  applicantName: string,
): Promise<string> {
  const parentFolderId = process.env.ZOHO_WORKDRIVE_PARENT_FOLDER_ID;
  if (!parentFolderId) {
    throw new Error("ZOHO_WORKDRIVE_PARENT_FOLDER_ID not configured");
  }

  const companyFolderId = await getOrCreateFolder(parentFolderId, sanitizeFolderName(companyName));
  const applicantFolderId = await getOrCreateFolder(companyFolderId, sanitizeFolderName(applicantName));

  return applicantFolderId;
}

export async function getOrCreateExportFolder(): Promise<string> {
  const parentFolderId = process.env.ZOHO_WORKDRIVE_PARENT_FOLDER_ID;
  if (!parentFolderId) {
    throw new Error("ZOHO_WORKDRIVE_PARENT_FOLDER_ID not configured");
  }
  return getOrCreateFolder(parentFolderId, "Data Exports");
}

export async function uploadFileToWorkDrive(
  folderId: string,
  fileBuffer: Buffer,
  fileName: string,
): Promise<{ fileId: string; permalink: string }> {
  const token = await getAccessToken();
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";

  const boundary = `----FormBoundary${Date.now()}`;
  const crlf = "\r\n";

  const preamble =
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="content"; filename="${fileName}"${crlf}` +
    `Content-Type: application/octet-stream${crlf}${crlf}`;

  const parentIdPart =
    `${crlf}--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="parent_id"${crlf}${crlf}` +
    folderId;

  const overridePart =
    `${crlf}--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="override-name-exist"${crlf}${crlf}` +
    "true";

  const epilogue = `${crlf}--${boundary}--${crlf}`;

  const preambleBuffer = Buffer.from(preamble, "utf-8");
  const parentIdBuffer = Buffer.from(parentIdPart, "utf-8");
  const overrideBuffer = Buffer.from(overridePart, "utf-8");
  const epilogueBuffer = Buffer.from(epilogue, "utf-8");

  const body = Buffer.concat([
    preambleBuffer,
    fileBuffer,
    parentIdBuffer,
    overrideBuffer,
    epilogueBuffer,
  ]);

  const response = await fetch(`${apiDomain}/workdrive/api/v1/upload`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body: body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho WorkDrive upload failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as any;
  const fileData = data?.data?.[0] || data?.data;

  if (!fileData) {
    throw new Error("No file data returned from Zoho WorkDrive upload");
  }

  const fileId = fileData.attributes?.resource_id || fileData.id;
  const permalink = fileData.attributes?.permalink || `https://workdrive.zoho.com/file/${fileId}`;

  return { fileId, permalink };
}

export async function syncFileToWorkDrive(
  companyName: string,
  applicantName: string,
  fileBuffer: Buffer,
  fileName: string,
): Promise<{ fileId: string; permalink: string }> {
  const folderId = await getApplicantFolderId(companyName, applicantName);
  return uploadFileToWorkDrive(folderId, fileBuffer, fileName);
}

export function isWorkDriveConfigured(): boolean {
  return !!(
    process.env.ZOHO_CLIENT_ID &&
    process.env.ZOHO_CLIENT_SECRET &&
    process.env.ZOHO_REFRESH_TOKEN &&
    process.env.ZOHO_WORKDRIVE_PARENT_FOLDER_ID
  );
}

export async function testWorkDriveConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    await getAccessToken();
    const parentFolderId = process.env.ZOHO_WORKDRIVE_PARENT_FOLDER_ID;
    if (!parentFolderId) {
      return { success: false, error: "Parent folder ID not configured" };
    }

    await listSubfolders(parentFolderId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
