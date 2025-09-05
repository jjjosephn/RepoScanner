import re
import hashlib
import math
from typing import List, Dict, Any
from dataclasses import dataclass

@dataclass
class SecretFinding:
    id: str
    type: str
    provider: str
    file: str
    line: int
    severity: str
    redacted_value: str
    description: str
    remediation: str

class SecretsDetector:
    def __init__(self):
        self.patterns = {
            # AWS
            "aws_access_key": {
                "pattern": r"AKIA[0-9A-Z]{16}",
                "provider": "AWS",
                "type": "Access Key",
                "severity": "high",
                "description": "AWS Access Key ID detected",
                "remediation": "Rotate this key immediately in AWS IAM console and use environment variables or AWS IAM roles instead."
            },
            "aws_secret_key": {
                "pattern": r"[A-Za-z0-9/+=]{40}",
                "provider": "AWS",
                "type": "Secret Key",
                "severity": "high",
                "description": "Potential AWS Secret Access Key detected",
                "remediation": "Rotate this key immediately and use AWS IAM roles or environment variables."
            },
            
            # Google Cloud
            "gcp_api_key": {
                "pattern": r"AIza[0-9A-Za-z\\-_]{35}",
                "provider": "Google Cloud",
                "type": "API Key",
                "severity": "high",
                "description": "Google Cloud API Key detected",
                "remediation": "Regenerate this API key in Google Cloud Console and restrict its usage to specific APIs and IP addresses."
            },
            "gcp_service_account": {
                "pattern": r'"type":\s*"service_account"',
                "provider": "Google Cloud",
                "type": "Service Account",
                "severity": "high",
                "description": "Google Cloud Service Account JSON detected",
                "remediation": "Remove this service account file and use Google Cloud IAM roles or environment-based authentication."
            },
            
            # GitHub
            "github_token": {
                "pattern": r"gh[pousr]_[A-Za-z0-9_]{36,255}",
                "provider": "GitHub",
                "type": "Personal Access Token",
                "severity": "high",
                "description": "GitHub Personal Access Token detected",
                "remediation": "Revoke this token in GitHub Settings > Developer settings > Personal access tokens and use GitHub Actions secrets instead."
            },
            "github_oauth": {
                "pattern": r"gho_[A-Za-z0-9_]{36}",
                "provider": "GitHub",
                "type": "OAuth Token",
                "severity": "high",
                "description": "GitHub OAuth Token detected",
                "remediation": "Revoke this OAuth token and regenerate it through your GitHub OAuth app settings."
            },
            
            # Slack
            "slack_token": {
                "pattern": r"xox[baprs]-([0-9a-zA-Z]{10,48})",
                "provider": "Slack",
                "type": "API Token",
                "severity": "medium",
                "description": "Slack API Token detected",
                "remediation": "Regenerate this token in your Slack app settings and use environment variables."
            },
            "slack_webhook": {
                "pattern": r"https://hooks\.slack\.com/services/[A-Za-z0-9+/]{44,46}",
                "provider": "Slack",
                "type": "Webhook URL",
                "severity": "medium",
                "description": "Slack Webhook URL detected",
                "remediation": "Regenerate this webhook URL in your Slack workspace settings."
            },
            
            # Stripe
            "stripe_live_key": {
                "pattern": r"sk_live_[0-9a-zA-Z]{24,34}",
                "provider": "Stripe",
                "type": "Live Secret Key",
                "severity": "high",
                "description": "Stripe Live Secret Key detected",
                "remediation": "Immediately rotate this key in Stripe Dashboard and use environment variables."
            },
            "stripe_test_key": {
                "pattern": r"sk_test_[0-9a-zA-Z]{24,34}",
                "provider": "Stripe",
                "type": "Test Secret Key",
                "severity": "medium",
                "description": "Stripe Test Secret Key detected",
                "remediation": "Rotate this test key and use environment variables for API keys."
            },
            
            # OpenAI
            "openai_api_key": {
                "pattern": r"sk-[a-zA-Z0-9]{48}",
                "provider": "OpenAI",
                "type": "API Key",
                "severity": "high",
                "description": "OpenAI API Key detected",
                "remediation": "Regenerate this API key in OpenAI dashboard and use environment variables."
            },
            
            # JWT Tokens
            "jwt_token": {
                "pattern": r"eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*",
                "provider": "JWT",
                "type": "JSON Web Token",
                "severity": "medium",
                "description": "JSON Web Token detected",
                "remediation": "Ensure JWTs are not hardcoded and use short expiration times with proper secret management."
            },
            
            # Generic patterns
            "private_key": {
                "pattern": r"-----BEGIN [A-Z]+ PRIVATE KEY-----",
                "provider": "Generic",
                "type": "Private Key",
                "severity": "high",
                "description": "Private key detected",
                "remediation": "Remove this private key and use secure key management services or environment variables."
            },
            "password": {
                "pattern": r"(?i)(password|pwd|pass)\s*[:=]\s*['\"][^'\"]{8,}['\"]",
                "provider": "Generic",
                "type": "Password",
                "severity": "medium",
                "description": "Hardcoded password detected",
                "remediation": "Remove hardcoded passwords and use environment variables or secure credential storage."
            }
        }
    
    def calculate_entropy(self, text: str) -> float:
        """Calculate Shannon entropy of a string"""
        if not text:
            return 0
        
        # Count character frequencies
        char_counts = {}
        for char in text:
            char_counts[char] = char_counts.get(char, 0) + 1
        
        # Calculate entropy
        entropy = 0
        text_len = len(text)
        for count in char_counts.values():
            probability = count / text_len
            entropy -= probability * math.log2(probability)
        
        return entropy
    
    def is_high_entropy(self, text: str, min_length: int = 20, min_entropy: float = 4.5) -> bool:
        """Check if text has high entropy (likely to be a secret)"""
        if len(text) < min_length:
            return False
        
        entropy = self.calculate_entropy(text)
        return entropy >= min_entropy
    
    def redact_secret(self, secret: str) -> str:
        """Redact a secret, showing only partial information"""
        if len(secret) <= 8:
            return "*" * len(secret)
        
        # Show first 4 and last 4 characters
        return secret[:4] + "*" * (len(secret) - 8) + secret[-4:]
    
    def scan_content(self, content: str, file_path: str) -> List[Dict[str, Any]]:
        """Scan file content for secrets"""
        findings = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            # Skip comments and common false positives
            stripped_line = line.strip()
            if (stripped_line.startswith('#') or 
                stripped_line.startswith('//') or
                stripped_line.startswith('*') or
                'example' in stripped_line.lower() or
                'sample' in stripped_line.lower() or
                'test' in stripped_line.lower()):
                continue
            
            # Check against known patterns
            for pattern_name, pattern_info in self.patterns.items():
                matches = re.finditer(pattern_info["pattern"], line, re.IGNORECASE)
                
                for match in matches:
                    secret_value = match.group(0)
                    
                    # Additional validation for some patterns
                    if pattern_name == "aws_secret_key":
                        # Only flag if it looks like a real AWS secret key
                        if not self.is_high_entropy(secret_value, min_length=40, min_entropy=4.0):
                            continue
                    
                    finding = {
                        "id": hashlib.md5(f"{file_path}:{line_num}:{secret_value}".encode()).hexdigest(),
                        "type": pattern_info["type"],
                        "provider": pattern_info["provider"],
                        "file": file_path,
                        "line": line_num,
                        "severity": pattern_info["severity"],
                        "redactedValue": self.redact_secret(secret_value),
                        "description": pattern_info["description"],
                        "remediation": pattern_info["remediation"]
                    }
                    
                    findings.append(finding)
            
            # Check for high-entropy strings that might be secrets
            words = re.findall(r'[A-Za-z0-9+/=]{20,}', line)
            for word in words:
                if self.is_high_entropy(word) and not any(
                    re.search(pattern_info["pattern"], word, re.IGNORECASE) 
                    for pattern_info in self.patterns.values()
                ):
                    finding = {
                        "id": hashlib.md5(f"{file_path}:{line_num}:{word}".encode()).hexdigest(),
                        "type": "High Entropy String",
                        "provider": "Generic",
                        "file": file_path,
                        "line": line_num,
                        "severity": "medium",
                        "redactedValue": self.redact_secret(word),
                        "description": "High entropy string detected - possible secret or token",
                        "remediation": "Review this string to ensure it's not a hardcoded secret. Use environment variables for sensitive data."
                    }
                    
                    findings.append(finding)
        
        return findings
