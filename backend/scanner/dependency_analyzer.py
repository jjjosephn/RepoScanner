import json
import re
import hashlib
import httpx
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import asyncio

@dataclass
class DependencyRisk:
    id: str
    package: str
    version: str
    risk_level: str
    vulnerability: str
    cve: Optional[str]
    advisory_url: Optional[str]
    recommended_version: str
    description: str

class DependencyAnalyzer:
    def __init__(self):
        # Known compromised packages from recent supply chain attacks
        self.compromised_packages = {
            "eslint-config-prettier": {
                "compromised_versions": ["8.1.0", "8.2.0"],
                "description": "Compromised version contained malicious code",
                "risk_level": "critical",
                "recommended_version": "8.3.0"
            },
            "synckit": {
                "compromised_versions": ["0.8.4", "0.8.5"],
                "description": "Supply chain attack with malicious payload",
                "risk_level": "critical", 
                "recommended_version": "0.8.6"
            },
            "@pkgr/core": {
                "compromised_versions": ["0.1.0"],
                "description": "Malicious package in npm registry",
                "risk_level": "critical",
                "recommended_version": "Remove package"
            },
            "event-stream": {
                "compromised_versions": ["3.3.6"],
                "description": "Bitcoin wallet stealing malware",
                "risk_level": "critical",
                "recommended_version": "3.3.4"
            },
            "flatmap-stream": {
                "compromised_versions": ["0.1.1"],
                "description": "Malicious dependency of event-stream",
                "risk_level": "critical",
                "recommended_version": "Remove package"
            }
        }
        
        # Known vulnerable packages with CVEs
        self.known_vulnerabilities = {
            "lodash": {
                "vulnerable_versions": ["<4.17.21"],
                "cve": "CVE-2021-23337",
                "description": "Prototype pollution vulnerability",
                "risk_level": "high",
                "recommended_version": "4.17.21",
                "advisory_url": "https://github.com/advisories/GHSA-35jh-r3h4-6jhm"
            },
            "axios": {
                "vulnerable_versions": ["<0.21.2"],
                "cve": "CVE-2021-3749",
                "description": "Regular expression denial of service",
                "risk_level": "medium",
                "recommended_version": "0.21.2",
                "advisory_url": "https://github.com/advisories/GHSA-cph5-m8f7-6c5x"
            },
            "node-fetch": {
                "vulnerable_versions": ["<2.6.7", "3.0.0-beta.9"],
                "cve": "CVE-2022-0235",
                "description": "Exposure of sensitive information",
                "risk_level": "medium",
                "recommended_version": "2.6.7",
                "advisory_url": "https://github.com/advisories/GHSA-r683-j2x4-v87g"
            },
            "minimist": {
                "vulnerable_versions": ["<1.2.6"],
                "cve": "CVE-2021-44906",
                "description": "Prototype pollution vulnerability",
                "risk_level": "high",
                "recommended_version": "1.2.6",
                "advisory_url": "https://github.com/advisories/GHSA-xvch-5gv4-984h"
            },
            "tar": {
                "vulnerable_versions": ["<4.4.18", ">=5.0.0 <5.0.8", ">=6.0.0 <6.1.9"],
                "cve": "CVE-2021-32803",
                "description": "Arbitrary file creation/overwrite vulnerability",
                "risk_level": "high",
                "recommended_version": "6.1.9",
                "advisory_url": "https://github.com/advisories/GHSA-r628-mhmh-qjhw"
            },
            "path-parse": {
                "vulnerable_versions": ["<1.0.7"],
                "cve": "CVE-2021-23343",
                "description": "Regular expression denial of service",
                "risk_level": "medium",
                "recommended_version": "1.0.7",
                "advisory_url": "https://github.com/advisories/GHSA-hj48-42vr-x3v9"
            },
            "trim-newlines": {
                "vulnerable_versions": ["<3.0.1"],
                "cve": "CVE-2021-33623",
                "description": "Regular expression denial of service",
                "risk_level": "medium",
                "recommended_version": "3.0.1",
                "advisory_url": "https://github.com/advisories/GHSA-7p7h-4mm5-852v"
            },
            "glob-parent": {
                "vulnerable_versions": ["<5.1.2"],
                "cve": "CVE-2020-28469",
                "description": "Regular expression denial of service",
                "risk_level": "medium",
                "recommended_version": "5.1.2",
                "advisory_url": "https://github.com/advisories/GHSA-ww39-953v-wcq6"
            }
        }
    
    def parse_version(self, version_str: str) -> tuple:
        """Parse version string into comparable tuple"""
        # Remove common prefixes and suffixes
        version = re.sub(r'^[~^>=<]+', '', version_str)
        version = re.sub(r'[-+].*$', '', version)
        
        # Split into parts and convert to integers
        parts = []
        for part in version.split('.'):
            try:
                parts.append(int(part))
            except ValueError:
                # Handle non-numeric parts
                parts.append(0)
        
        # Ensure we have at least 3 parts (major.minor.patch)
        while len(parts) < 3:
            parts.append(0)
        
        return tuple(parts[:3])
    
    def is_version_vulnerable(self, current_version: str, vulnerable_range: str) -> bool:
        """Check if current version falls within vulnerable range"""
        try:
            current = self.parse_version(current_version)
            
            # Handle different range formats
            if vulnerable_range.startswith('<'):
                max_version = self.parse_version(vulnerable_range[1:])
                return current < max_version
            elif vulnerable_range.startswith('>=') and '<' in vulnerable_range:
                # Range like ">=5.0.0 <5.0.8"
                parts = vulnerable_range.split(' ')
                min_version = self.parse_version(parts[0][2:])
                max_version = self.parse_version(parts[1][1:])
                return min_version <= current < max_version
            elif '||' in vulnerable_range:
                # Multiple ranges
                ranges = vulnerable_range.split('||')
                return any(self.is_version_vulnerable(current_version, r.strip()) for r in ranges)
            
            return False
        except Exception:
            return False
    
    async def analyze_dependencies(self, content: str, filename: str) -> List[Dict[str, Any]]:
        """Analyze dependencies for security risks"""
        risks = []
        
        try:
            if filename == "package.json":
                data = json.loads(content)
                dependencies = {}
                
                # Collect all dependencies
                for dep_type in ["dependencies", "devDependencies", "peerDependencies"]:
                    if dep_type in data:
                        dependencies.update(data[dep_type])
                
                # Analyze each dependency
                for package_name, version in dependencies.items():
                    package_risks = self.analyze_package(package_name, version)
                    risks.extend(package_risks)
            
            elif filename in ["package-lock.json", "yarn.lock"]:
                # For lock files, we'll do a simpler analysis
                if filename == "package-lock.json":
                    risks.extend(await self.analyze_package_lock(content))
                else:
                    risks.extend(await self.analyze_yarn_lock(content))
        
        except json.JSONDecodeError:
            pass
        except Exception as e:
            print(f"Error analyzing dependencies: {e}")
        
        return risks
    
    def analyze_package(self, package_name: str, version: str) -> List[Dict[str, Any]]:
        """Analyze a single package for security risks"""
        risks = []
        
        # Check for compromised packages
        if package_name in self.compromised_packages:
            compromise_info = self.compromised_packages[package_name]
            
            # Extract version number from version string
            clean_version = re.sub(r'^[~^>=<]+', '', version)
            
            if clean_version in compromise_info["compromised_versions"]:
                risk = {
                    "id": hashlib.md5(f"{package_name}:{version}:compromised".encode()).hexdigest(),
                    "package": package_name,
                    "version": clean_version,
                    "riskLevel": compromise_info["risk_level"],
                    "vulnerability": "Compromised Package",
                    "cve": None,
                    "advisoryUrl": None,
                    "recommendedVersion": compromise_info["recommended_version"],
                    "description": compromise_info["description"]
                }
                risks.append(risk)
        
        # Check for known vulnerabilities
        if package_name in self.known_vulnerabilities:
            vuln_info = self.known_vulnerabilities[package_name]
            
            # Check if current version is vulnerable
            clean_version = re.sub(r'^[~^>=<]+', '', version)
            
            for vuln_range in vuln_info["vulnerable_versions"]:
                if self.is_version_vulnerable(clean_version, vuln_range):
                    risk = {
                        "id": hashlib.md5(f"{package_name}:{version}:vulnerable".encode()).hexdigest(),
                        "package": package_name,
                        "version": clean_version,
                        "riskLevel": vuln_info["risk_level"],
                        "vulnerability": vuln_info["description"],
                        "cve": vuln_info.get("cve"),
                        "advisoryUrl": vuln_info.get("advisory_url"),
                        "recommendedVersion": vuln_info["recommended_version"],
                        "description": f"Known vulnerability in {package_name} {clean_version}"
                    }
                    risks.append(risk)
                    break
        
        return risks
    
    async def analyze_package_lock(self, content: str) -> List[Dict[str, Any]]:
        """Analyze package-lock.json for vulnerabilities"""
        risks = []
        
        try:
            data = json.loads(content)
            
            # Check packages in lockfile
            if "packages" in data:
                for package_path, package_info in data["packages"].items():
                    if package_path == "":  # Skip root package
                        continue
                    
                    package_name = package_path.split("node_modules/")[-1]
                    version = package_info.get("version", "")
                    
                    if package_name and version:
                        package_risks = self.analyze_package(package_name, version)
                        risks.extend(package_risks)
            
            # Also check legacy dependencies format
            elif "dependencies" in data:
                for package_name, package_info in data["dependencies"].items():
                    version = package_info.get("version", "")
                    if version:
                        package_risks = self.analyze_package(package_name, version)
                        risks.extend(package_risks)
        
        except json.JSONDecodeError:
            pass
        except Exception as e:
            print(f"Error analyzing package-lock.json: {e}")
        
        return risks
    
    async def analyze_yarn_lock(self, content: str) -> List[Dict[str, Any]]:
        """Analyze yarn.lock for vulnerabilities"""
        risks = []
        
        try:
            # Parse yarn.lock format (simplified)
            lines = content.split('\n')
            current_package = None
            current_version = None
            
            for line in lines:
                line = line.strip()
                
                # Package declaration line
                if line and not line.startswith(' ') and '@' in line and ':' in line:
                    # Extract package name and version
                    package_part = line.split(':')[0].strip()
                    if '@' in package_part:
                        parts = package_part.rsplit('@', 1)
                        if len(parts) == 2:
                            current_package = parts[0].strip('"')
                
                # Version line
                elif line.startswith('version ') and current_package:
                    current_version = line.split('version ')[1].strip('"')
                    
                    # Analyze this package
                    if current_package and current_version:
                        package_risks = self.analyze_package(current_package, current_version)
                        risks.extend(package_risks)
                    
                    current_package = None
                    current_version = None
        
        except Exception as e:
            print(f"Error analyzing yarn.lock: {e}")
        
        return risks
