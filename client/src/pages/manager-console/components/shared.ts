import { apiRequest } from "@/lib/queryClient";

export async function logChange(entityType: string, entityId: string, entityName: string, oldData: any, newData: any) {
  try {
    await apiRequest("POST", "/api/change-notifications", {
      entityType,
      entityId,
      entityName,
      oldData,
      newData,
    });
  } catch (err) {
    console.error("Failed to log change notification:", err);
  }
}
