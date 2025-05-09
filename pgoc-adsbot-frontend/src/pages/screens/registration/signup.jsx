import React, { useState } from "react";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from "@mui/material"; // Add Dialog components
import notify from "../../components/toast"; // Import notify from your toast setup
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { Box } from "@mui/system";

const Signup = ({ setSignupVisible }) => {
  const apiUrl = import.meta.env.VITE_API_URL;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState("");
  const [code, setCode] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [loading, setLoading] = useState(false); // Track loading state to avoid multiple requests
  const [signupLoading, setSignupLoading] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isVerifyingInvite, setIsVerifyingInvite] = useState(false);
  const [isInviteValid, setIsInviteValid] = useState(false);

  const currentDomain = window.location.hostname;
  const currentPort = window.location.port ? `:${window.location.port}` : "";
  const domainWithPort = currentDomain + currentPort;

  const togglePasswordVisibility = () => setPasswordVisible(!passwordVisible);

  const toggleConfirmPasswordVisibility = () =>
    setConfirmPasswordVisible(!confirmPasswordVisible);

  const handleGetCode = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      notify("Email is required.", "error");
      return;
    }

    if (!emailRegex.test(email)) {
      notify("Please enter a valid email address.", "error");
      return;
    }

    const requestBody = { email, domain: domainWithPort };
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/v1/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          skip_zrok_interstitial: "true",
        },
        body: JSON.stringify(requestBody),
      });
      if (response.ok) {
        notify("Verification Code sent.. please check your email!", "success");
      } else {
        notify("Error sending code. Please try again.", "error");
      }
    } catch (error) {
      notify("Error sending code. Please try again later.", "error");
      console.error("Error sending code:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = async (e) => {
    const newCode = e.target.value;
    setCode(newCode);

    if (newCode.length === 6 && !loading) {
      setLoading(true);
      try {
        const response = await fetch(
          `${apiUrl}/api/v1/auth/verify-email/${newCode}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              skip_zrok_interstitial: "true", // Include the token if needed
            },
          }
        );

        if (response.ok) {
          setIsCodeVerified(true);
          notify("Code verified successfully!", "success");
        } else {
          setIsCodeVerified(false);
          notify("Invalid code! Please try again.", "error");
        }
      } catch (error) {
        setIsCodeVerified(false);
        notify("Error verifying code. Please try again later.", "error");
        console.error("Error verifying code:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const register = async (userData) => {
    try {
      setSignupLoading(true);
      const response = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          skip_zrok_interstitial: "true",
        },
        body: JSON.stringify(userData),
      });
      
      if (response.ok) {
        notify("Registration successful! You can now log in.", "success");
        setTimeout(() => {
          setSignupVisible(false); // Switch to Login after success
        }, 1500);
      } else {
        const data = await response.json();
        notify(
          data.message || "Registration failed. Please try again.",
          "error"
        );
      }
    } catch (error) {
      notify("Network error. Please try again later.", "error");
      console.error("Error during registration:", error);
    } finally {
      setSignupLoading(false);
    }
  };

  const handleShowInviteCode = () => {
    setShowInviteCode(true);
  };

  const handleVerifyInviteCode = async (e) => {
    const code = e.target.value;
    setInviteCode(code);

    if (code.length === 8 && !isVerifyingInvite) {
      setIsVerifyingInvite(true);
      try {
        const response = await fetch(`${apiUrl}/api/v1/user/invite-codes/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            skip_zrok_interstitial: 'true'
          },
          body: JSON.stringify({
            invite_code: code.trim()
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.valid) {
            setIsInviteValid(true);
            notify("Invite code is valid!", "success");
          } else {
            setIsInviteValid(false);
            notify(data.message || "Invalid invite code", "error");
          }
        } else {
          const errorData = await response.json();
          setIsInviteValid(false);
          notify(errorData.error || "Invalid invite code", "error");
        }
      } catch (error) {
        setIsInviteValid(false);
        notify("Error verifying invite code", "error");
        console.error("Error verifying invite code:", error);
      } finally {
        setIsVerifyingInvite(false);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;

    if (!fullName.trim()) {
      notify("Full name is required.", "error");
      return;
    }

    if (!email.trim()) {
      notify("Email is required.", "error");
      return;
    }

    if (!emailRegex.test(email)) {
      notify("Please enter a valid email address.", "error");
      return;
    }

    if (!password.trim()) {
      notify("Password is required.", "error");
      return;
    }

    if (!passwordRegex.test(password)) {
      notify(
        "Password must be at least 6 characters long and include at least 1 letter and 1 number.",
        "error"
      );
      return;
    }

    if (password !== confirmPassword) {
      notify("Passwords do not match.", "error");
      return;
    }

    if (!gender) {
      notify("Please select your gender.", "error");
      return;
    }

    if (showInviteCode && !isInviteValid) {
      notify("Please enter a valid invite code", "error");
      return;
    }

    const userData = {
      username: email.split("@")[0],
      full_name: fullName,
      password,
      email,
      gender,
      domain: domainWithPort,
      user_level: 3,
      user_role: "staff",
      invite_code: showInviteCode ? inviteCode : null // Include invite code if it was entered and validated
    };

    register(userData);
  };

  return (
    <div
      className="user_forms-signup"
      style={{ minHeight: "420px", top: "5px" }}
    >
      <h2
        className="forms_title"
        style={{ fontSize: "1.5rem", marginBottom: "12px" }}
      >
        Create Account
      </h2>
      <form className="forms_form" onSubmit={handleSubmit}>
        <fieldset className="forms_fieldset" style={{ padding: "10px" }}>
          <div className="forms_field">
            <input
              type="text"
              placeholder="Full Name"
              className="forms_field-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={{ padding: "6px 10px", fontSize: "12px" }}
            />
          </div>

          <div className="forms_field">
            <input
              type="email"
              placeholder="Email"
              className="forms_field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: "6px 10px", fontSize: "12px" }}
            />
          </div>

          <div
            className="forms_field"
            style={{ display: "flex", alignItems: "center" }}
          >
            <input
              type="text"
              placeholder="Code"
              className="forms_field-input"
              value={code}
              onChange={handleCodeChange}
              required
              style={{
                flex: 1,
                marginRight: "10px",
                padding: "6px 10px",
                fontSize: "12px",
              }}
            />
            <button
              type="button"
              className="forms_buttons-action"
              onClick={handleGetCode}
              disabled={loading}
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              {loading ? (
                <CircularProgress size={24} style={{ color: "#fff" }} />
              ) : (
                "Get Code"
              )}
            </button>
          </div>

          <div className="forms_field relative">
            <input
              type={passwordVisible ? "text" : "password"}
              placeholder="Password"
              className="forms_field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                padding: "6px 10px",
                fontSize: "12px",
                paddingRight: "40px",
              }}
            />
            <span
              onClick={togglePasswordVisibility}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
              }}
            >
              {passwordVisible ? (
                <VisibilityOff style={{ fontSize: "20px", color: "#888" }} />
              ) : (
                <Visibility style={{ fontSize: "20px", color: "#888" }} />
              )}
            </span>
          </div>

          <div className="forms_field relative">
            <input
              type={confirmPasswordVisible ? "text" : "password"}
              placeholder="Confirm Password"
              className="forms_field-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                padding: "6px 10px",
                fontSize: "12px",
                paddingRight: "40px",
              }}
            />
            <span
              onClick={toggleConfirmPasswordVisibility}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
              }}
            >
              {confirmPasswordVisible ? (
                <VisibilityOff style={{ fontSize: "20px", color: "#888" }} />
              ) : (
                <Visibility style={{ fontSize: "20px", color: "#888" }} />
              )}
            </span>
          </div>

          <div className="forms_field">
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="forms_field-input"
              required
              style={{ padding: "6px 10px", fontSize: "12px" }}
            >
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          {!showInviteCode ? (
            <div className="forms_field" style={{ marginTop: "10px" }}>
              <button
                type="button"
                onClick={handleShowInviteCode}
                className="forms_buttons-action"
                style={{
                  backgroundColor: "#1976d2",
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  width: "100%",
                  fontSize: "14px"
                }}
              >
                Do you have an invite code?
              </button>
            </div>
          ) : (
            <div className="forms_field" style={{ marginTop: "10px" }}>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Enter Invite Code"
                  className="forms_field-input"
                  value={inviteCode}
                  onChange={handleVerifyInviteCode}
                  style={{
                    padding: "6px 10px",
                    fontSize: "12px",
                    paddingRight: "40px",
                    borderColor: isInviteValid ? "#4CAF50" : isVerifyingInvite ? "#1976d2" : "#ccc"
                  }}
                />
                {isVerifyingInvite && (
                  <CircularProgress
                    size={20}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#1976d2"
                    }}
                  />
                )}
                {isInviteValid && !isVerifyingInvite && (
                  <span style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#4CAF50"
                  }}>
                    ✓
                  </span>
                )}
              </div>
            </div>
          )}
        </fieldset>
        <div className="forms_buttons" style={{ marginTop: "10px" }}>
          <button
            type="submit"
            className="forms_buttons-action"
            style={{
              backgroundColor: isCodeVerified && (!showInviteCode || isInviteValid)
                ? "rgba(138, 0, 0, 0.85)"
                : "#ccc",
              cursor: isCodeVerified && (!showInviteCode || isInviteValid)
                ? "pointer"
                : "not-allowed",
              color: "#fff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "5px",
              fontSize: "14px",
              transition: "background-color 0.3s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
            disabled={!isCodeVerified || (showInviteCode && !isInviteValid) || signupLoading}
          >
            {signupLoading ? (
              <CircularProgress size={18} style={{ color: "#fff" }} />
            ) : (
              "Sign Up"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Signup;
