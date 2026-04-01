import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, User, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUpload } from "@/hooks/use-upload";
import proLogo from "@assets/Our_Logo_transparent.png";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  personalEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  eidNumber: z.string().optional().or(z.literal("")),
  sameAsPhone: z.boolean().default(false),
});

type ProfileForm = z.infer<typeof profileSchema>;

type ProfileData = {
  id: string;
  name: string;
  email: string;
  role: string;
  staffId: string | null;
  phone: string | null;
  whatsapp: string | null;
  personalEmail: string | null;
  eidNumber: string | null;
  profilePhotoUrl: string | null;
  profileCompleted: boolean;
};

function getRedirectForRole(role: string): string {
  switch (role) {
    case "Admin": return "/";
    case "Client Relationship Manager": return "/crm";
    case "PRO":
    case "PRO - Temporary": return "/medical";
    default: return "/";
  }
}

export default function ProfileComplete() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const { data: profileData, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ["/api/auth/profile"],
    enabled: !!user,
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      personalEmail: "",
      phone: "",
      whatsapp: "",
      eidNumber: "",
      sameAsPhone: false,
    },
    values: profileData
      ? {
          name: profileData.name || "",
          personalEmail: profileData.personalEmail || "",
          phone: profileData.phone || "",
          whatsapp: profileData.whatsapp || "",
          eidNumber: profileData.eidNumber || "",
          sameAsPhone: false,
        }
      : undefined,
  });

  const { uploadFile } = useUpload({
    onSuccess: (response) => {
      setProfilePhotoUrl(response.objectPath);
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const payload = {
        name: data.name,
        personalEmail: data.personalEmail || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || null,
        eidNumber: data.eidNumber || null,
        profilePhotoUrl: profilePhotoUrl || profileData?.profilePhotoUrl || null,
      };
      const res = await apiRequest("PUT", "/api/auth/profile", payload);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save profile");
      }
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/auth/me"], (prev: unknown) => {
        if (!prev) return prev;
        return { ...(prev as object), name: updated.name };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/profile"] });
      toast({ title: "Profile saved!", description: "Welcome aboard." });
      setTimeout(() => {
        setLocation(getRedirectForRole(user?.role || "PRO"));
      }, 600);
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setPhotoUploading(true);
    try {
      await uploadFile(file);
    } catch {
      toast({ title: "Upload failed", description: "Could not upload photo.", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  };

  const onSubmit = (data: ProfileForm) => {
    const payload = { ...data };
    if (data.sameAsPhone) {
      payload.whatsapp = data.phone;
    }
    profileMutation.mutate(payload);
  };

  const watchPhone = form.watch("phone");
  const watchSameAsPhone = form.watch("sameAsPhone");

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPhotoUrl = photoPreview || (profileData?.profilePhotoUrl ? `/objects/${profileData.profilePhotoUrl}` : null);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex flex-col items-center mb-8">
          <img
            src={proLogo}
            alt="The P.R.O. Company"
            className="h-12 w-12 rounded-xl object-contain mb-4"
            data-testid="img-pro-logo"
          />
          <h1 className="text-2xl font-bold text-foreground">Complete your profile</h1>
          <p className="text-muted-foreground text-sm mt-1 text-center">
            Fill in your details to get started. You can update these later.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex justify-center mb-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative group"
              data-testid="button-upload-photo"
            >
              <div className="h-20 w-20 rounded-full bg-muted border-2 border-border flex items-center justify-center overflow-hidden">
                {photoUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : currentPhotoUrl ? (
                  <img src={currentPhotoUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                <Camera className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
              data-testid="input-photo-upload"
            />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Your full name" data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Work Email</FormLabel>
                <Input
                  value={profileData?.email || user?.email || ""}
                  readOnly
                  disabled
                  className="mt-1.5 bg-muted/50"
                  data-testid="input-work-email"
                />
              </div>

              <FormField
                control={form.control}
                name="personalEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="personal@example.com"
                        data-testid="input-personal-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="+971 50 000 0000"
                        data-testid="input-phone"
                        onChange={(e) => {
                          field.onChange(e);
                          if (watchSameAsPhone) {
                            form.setValue("whatsapp", e.target.value);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="+971 50 000 0000"
                        disabled={watchSameAsPhone}
                        value={watchSameAsPhone ? (watchPhone || "") : field.value}
                        data-testid="input-whatsapp"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sameAsPhone"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 -mt-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue("whatsapp", watchPhone || "");
                          }
                        }}
                        data-testid="checkbox-same-as-phone"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 font-normal text-muted-foreground cursor-pointer">
                      Same as phone number
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eidNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emirates ID Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="784-XXXX-XXXXXXX-X"
                        data-testid="input-eid-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={profileMutation.isPending || photoUploading}
                  data-testid="button-save-profile"
                >
                  {profileMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving…
                    </>
                  ) : profileMutation.isSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Saved!
                    </>
                  ) : (
                    "Save and continue"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can update your profile later from account settings.
        </p>
      </div>
    </div>
  );
}
