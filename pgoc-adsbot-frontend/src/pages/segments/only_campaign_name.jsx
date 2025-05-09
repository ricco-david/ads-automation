import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Card,
  CardContent,
} from "@mui/material";
import OnlyScheduleAccountWidget from "../widgets/only_campaign_name/only_scheduled_accounts";
import OnlyScheduleCardData from "../widgets/only_campaign_name/only_schedule_data_card";
import CustomButton from "../components/buttons";
import ExportIcon from "@mui/icons-material/FileUpload";
import UploadIcon from "@mui/icons-material/CloudUpload";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LoadingWidgetCard from "../components/skeleton_widgets";
import notify from "../components/toast.jsx";
import OnlyOnOffTerminal from "../widgets/only_campaign_name/only_terminal.jsx";
import { getUserData } from "../../services/user_data.js";
import CampaignNameImportWidget from "../widgets/only_campaign_name/only_import_dialog.jsx";
import { EventSource } from "extended-eventsource";

const apiUrl = import.meta.env.VITE_API_URL;

const CampaignNameOnlyPage = ({ userData }) => {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [openOffDialog, setOpenOffDialog] = useState(false);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState({});
  const [importProgress, setImportProgress] = useState({});
  const [isVisible, setIsVisible] = useState(true); // Track visibility

  const eventSourceRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const timeoutRef = useRef(null); // Track timeout for no messagE

  useEffect(() => {
    if (!userData?.id) return;
    fetchCampaignSchedules();
  }, [userData?.id]);

  useEffect(() => {
    if (selectedAccount?.ad_account_id) {
      createEventSource(selectedAccount.ad_account_id);
    } else {
      destroyEventSource();
    }

    return () => destroyEventSource();
  }, [selectedAccount]);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const addMessage = (adAccountId, newMessages) => {
    setMessages((prevMessages) => {
      const currentMessages = prevMessages[adAccountId] || [];

      // Use a Set to store unique messages (assuming messages are strings or have unique identifiers)
      const uniqueMessages = new Map(
        [...currentMessages, ...newMessages].map((msg) => [
          JSON.stringify(msg),
          msg,
        ])
      );

      return {
        ...prevMessages,
        [adAccountId]: Array.from(uniqueMessages.values()), // Convert back to array
      };
    });

    resetMessageTimeout(adAccountId);
  };

  const resetMessageTimeout = (adAccountId) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setMessages((prevMessages) => {
        const currentMessages = prevMessages[adAccountId] || [];

        const lastMessage =
          prevMessages[adAccountId]?.find((msg) =>
            msg.startsWith("Last Checked Message:")
          ) ||
          selectedAccount?.last_message ||
          "No recent activity.";

        const botMessages = [
          lastMessage ? `📌 Last Checked Message: ${lastMessage}` : null,
          `⚡ Waiting for Scheduled Campaign ON/OFF... (${new Date().toLocaleTimeString()})`,
        ].filter(Boolean);

        const updatedMessages = [
          ...new Set([...currentMessages, ...botMessages]),
        ];

        console.log("🚀 Updated Messages:", updatedMessages);
        return {
          ...prevMessages,
          [adAccountId]: updatedMessages,
        };
      });
    }, 5000); // Set to 5 seconds
  };

  const createEventSource = (adAccountId) => {
    if (eventSourceRef.current) {
      console.log("EventSource already exists. Skipping new instance.");
      return;
    }

    const redisKey = `${userData.id}-${adAccountId}-key`;
    const eventSource = new EventSource(
      `${apiUrl}/api/v1/messageevents-only?keys=${redisKey}`,
      {
        headers: {
          "ngrok-skip-browser-warning": "true",
          skip_zrok_interstitial: "true",
        },
        retry: 1500, // Auto-retry every 1.5s on failure
      }
    );

    eventSource.onopen = () => {
      console.log("Connected to SSE:", redisKey);
    };

    eventSource.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        console.log("Received SSE:", parsedData);

        if (parsedData.data?.message?.length) {
          addMessage(adAccountId, parsedData.data.message);
          console.log("Updated Messages via SSE");

          // Reset timeout to ensure bot messages display
          resetMessageTimeout(adAccountId);
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = () => {
      console.error("SSE connection error. Reconnecting...");
      eventSource.close();
      eventSourceRef.current = null;

      setTimeout(() => createEventSource(adAccountId), 3000);
    };

    eventSourceRef.current = eventSource;
  };

  const destroyEventSource = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log("❌ EventSource closed.");
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      if (selectedAccount?.ad_account_id) {
        createEventSource(selectedAccount.ad_account_id);
      }
    } else {
      destroyEventSource();
    }
  };

  let fetchInterval = null; // Global reference for interval

  const handleCreatingImported = async (importedData) => {
    if (!importedData || importedData.length === 0) {
      notify("No data to import", "error");
      return;
    }

    let progress = {};
    importedData.forEach((_, index) => {
      progress[index] = 0;
    });
    setImportProgress(progress);

    let successfulImports = 0; // Track successful campaigns

    // Start fetching schedules every 5 seconds while importing
    if (!fetchInterval) {
      fetchCampaignSchedules(); // Initial fetch
      fetchInterval = setInterval(fetchCampaignSchedules, 5000);
    }

    for (let index = 0; index < importedData.length; index++) {
      const campaign = importedData[index];

      try {
        // Optimize progress updates by batching
        for (let percent = 0; percent <= 100; percent += 50) {
          setImportProgress((prev) => ({ ...prev, [index]: percent }));
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        // Send API request
        const response = await fetch(
          `${apiUrl}/api/v1/campaign-only/create-campaign-only`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              skip_zrok_interstitial: "true",
            },
            body: JSON.stringify(campaign),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to create campaign: ${campaign.ad_account_id}`
          );
        }

        notify(
          `Campaign ${campaign.ad_account_id} created successfully!`,
          "success"
        );
        successfulImports++;
      } catch (error) {
        notify(error.message, "error");
        setImportProgress((prev) => ({ ...prev, [index]: "Failed" }));
      }
    }

    // Stop interval & fetch one last time after imports finish
    setTimeout(() => {
      clearInterval(fetchInterval);
      fetchInterval = null;
      fetchCampaignSchedules(); // Final fetch after importing
    }, 5000); // Keep fetching for 5 more seconds after finishing

    // Clear progress after 2 seconds
    setTimeout(() => setImportProgress({}), 2000);
  };

  const fetchCampaignSchedules = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${apiUrl}/api/v1/campaign-only/get-campaign-only?user_id=${userData.id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            skip_zrok_interstitial: "true",
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch campaign schedules");

      const data = await response.json();
      setSchedules(data);
    } catch (err) {
      setError(err.message);
      notify("Failed to fetch campaign schedules", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (account) => {
    setSelectedAccount((prev) =>
      prev?.ad_account_id === account.ad_account_id ? null : account
    );
  };

  const handleRemoveSchedule = async () => {
    if (!selectedAccount) {
      notify("No schedule selected to remove.", "error");
      return;
    }

    const { id } = getUserData();

    const payload = {
      id,
      ad_account_id: selectedAccount.ad_account_id,
    };

    try {
      const response = await fetch(
        `${apiUrl}/api/v1/campaign-only/delete-campaign-only`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            skip_zrok_interstitial: "true",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        notify(`Failed to delete schedule: ${errorText}`, "error");
        throw new Error(errorText);
      }

      notify("Schedule removed successfully!", "success");

      // Fetch updated schedules and reset selected account
      await fetchCampaignSchedules();
      setSelectedAccount(null);
    } catch (error) {
      notify("Error removing schedule", "error");
    }
  };

  const handleRemoveMultipleSchedules = async (ad_account_ids) => {
    if (!ad_account_ids || ad_account_ids.length === 0) {
      notify("No schedules selected to remove.", "error");
      return;
    }

    const { id } = getUserData();

    try {
      // Create a set to ensure we only process each ad_account_id once
      const uniqueAdAccounts = [...new Set(ad_account_ids)];

      for (const ad_account_id of uniqueAdAccounts) {
        // Find the first schedule to remove (assuming schedules are stored in `schedules`)
        const account = schedules.ad_accounts.find(
          (acc) => acc.ad_account_id === ad_account_id
        );

        if (!account || !account.schedule_data) {
          notify(`No schedule found for ${ad_account_id}`, "warning");
          continue;
        }

        // Get the first schedule key
        const firstScheduleKey = Object.keys(account.schedule_data)[0];

        if (!firstScheduleKey) {
          notify(`No schedule available for ${ad_account_id}`, "warning");
          continue;
        }

        const scheduleToRemove = account.schedule_data[firstScheduleKey];

        const payload = {
          id,
          ad_account_id,
          time: scheduleToRemove.time, // Specify the exact schedule time to delete
        };

        const response = await fetch(
          `${apiUrl}/api/v1/campaign-only/delete-campaign-only`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              skip_zrok_interstitial: "true",
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          notify(`Failed to delete schedule: ${errorText}`, "error");
          throw new Error(errorText);
        }

        notify(
          `Schedule for ${ad_account_id} at ${scheduleToRemove.time} removed successfully!`,
          "success"
        );
      }

      // Fetch updated schedules after deletion
      await fetchCampaignSchedules();
      setSelectedAccount(null);
    } catch (error) {
      notify("Error removing multiple schedules", "error");
    }
  };

  const handleDownloadCampaigns = () => {
    if (
      !schedules ||
      !Array.isArray(schedules.ad_accounts) ||
      schedules.ad_accounts.length === 0
    ) {
      notify("No campaign data available to export.", "warning");
      return;
    }

    const adAccounts = schedules.ad_accounts;

    // Construct CSV header
    const header = [
      "ad_account_id",
      "access_token",
      "time",
      "campaign_name",
      "on_off",
    ];

    // Construct CSV data rows
    const csvRows = adAccounts.flatMap((account) => {
      const { ad_account_id, access_token, schedule_data } = account || {};

      if (
        !schedule_data ||
        typeof schedule_data !== "object" ||
        Object.keys(schedule_data).length === 0
      ) {
        return [[ad_account_id || "", access_token || "", "", "", ""]]; // Empty row for consistency
      }

      return Object.values(schedule_data).map(
        ({ time, campaign_name, on_off }) => [
          ad_account_id || "",
          access_token || "",
          time || "", // Extracted from schedule_data
          Array.isArray(campaign_name) ? campaign_name.join(" / ") : "",
          on_off || "",
        ]
      );
    });

    // Convert to CSV format
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [header, ...csvRows].map((row) => row.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Campaign_Schedules_${new Date().toISOString()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify("Campaign data exported successfully!", "success");
  };

  return (
    <Box
      sx={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        width: "100%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          Schedule Campaigns ON/OFF
        </Typography>

        <Box sx={{ display: "flex", gap: "10px" }}>
          <CustomButton
            name="Import CSV"
            onClick={() => setOpenImportDialog(true)}
            type="tertiary"
            icon={<ExportIcon />}
          />
          <CampaignNameImportWidget
            open={openImportDialog}
            handleClose={() => setOpenImportDialog(false)}
            onImportComplete={handleCreatingImported}
            onRemoveSchedules={handleRemoveMultipleSchedules}
          />
          <CustomButton
            name="Download Data"
            onClick={handleDownloadCampaigns} // ✅ Directly passing the function reference
            type="tertiary"
            icon={<UploadIcon />}
          />
          {/* <CustomButton
            name="Create Schedule"
            onClick={() => console.log("Create Schedule clicked")}
            type="primary"
            disabled={true} // Correct way to set disabled
            icon={<AddIcon />}
          /> */}
          <CustomButton
            name="Remove Schedule"
            onClick={handleRemoveSchedule}
            type="secondary"
            icon={<DeleteIcon />}
            disabled={!selectedAccount}
          />
        </Box>
      </Box>

      {/* Cards Section */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "8px",
          width: "100%",
        }}
      >
        {loading ? (
          <>
            <LoadingWidgetCard />
            <LoadingWidgetCard />
            <LoadingWidgetCard height={"345px"} />
          </>
        ) : (
          <>
            {/* Column 1 */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <OnlyScheduleAccountWidget
                schedules={schedules}
                onSelectAccount={handleSelectAccount}
                fetchSchedules={fetchCampaignSchedules}
              />
            </Box>

            {/* Column 2 */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <OnlyScheduleCardData
                selectedAccount={selectedAccount}
                fetchSchedule={fetchCampaignSchedules}
              />
            </Box>

            {/* Column 3 - Terminal & Import Progress */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {/* Terminal Widget (Spans full height) */}
              <OnlyOnOffTerminal
                messages={messages[selectedAccount?.ad_account_id] || []}
                setMessages={(msgs) =>
                  setMessages((prev) => ({
                    ...prev,
                    [selectedAccount?.ad_account_id]: msgs,
                  }))
                }
                sx={{
                  flexGrow: 1, // Allow it to take remaining space
                  minHeight: "300px", // Adjust to ensure it takes proper space
                }}
              />

              {isVisible && (
                <Card
                  sx={{
                    padding: 2,
                    maxHeight: "290px",
                    height: "290px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent:
                      Object.keys(importProgress).length === 0
                        ? "center"
                        : "flex-start",
                    backgroundColor: "#f9f9f9",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                  }}
                >
                  <CardContent sx={{ width: "100%" }}>
                    {Object.keys(importProgress).length === 0 ? (
                      <Typography
                        variant="body2"
                        sx={{ textAlign: "center", color: "#777" }}
                      >
                        📂 No imported campaigns yet. Start importing to see
                        progress here.
                      </Typography>
                    ) : (
                      Object.entries(importProgress).map(
                        ([index, progress]) => (
                          <Box key={index} sx={{ marginBottom: 1 }}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: "bold" }}
                            >
                              Campaign {parseInt(index) + 1} -{" "}
                              {progress === "Failed"
                                ? " ❌ Failed"
                                : progress === 100
                                ? " ✅ Success"
                                : ` ${progress}%`}
                            </Typography>
                            {progress !== "Failed" && progress !== 100 && (
                              <LinearProgress
                                variant="determinate"
                                value={progress}
                                sx={{
                                  height: 8,
                                  borderRadius: 2,
                                  backgroundColor: "#ddd",
                                }}
                              />
                            )}
                          </Box>
                        )
                      )
                    )}
                  </CardContent>
                </Card>
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default CampaignNameOnlyPage;
