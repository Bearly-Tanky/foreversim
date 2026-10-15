-- Runs the ForeverSim addon against a mock of the game's API and prints ForeverSimDB the way the
-- game writes SavedVariables. luajit testground/tools/addon_test.lua > ForeverSim.lua
local events = {}
UNKNOWNOBJECT = "Unknown"
function UnitName() return "Thrall" end
function GetRealmName() return "Nightslayer" end
function UnitClass() return "Warrior", "WARRIOR", 1 end
function UnitRace() return "High Order Skyborne", "Skyborne", 95 end
function UnitSex() return 2 end
function UnitLevel() return 60 end
function time() return 1792100000 end
local links = {
	[1] = "|cffa335ee|Hitem:12640::::::::60:::::|h[Lionheart Helm]|h|r",
	[16] = "|cffff8000|Hitem:19019:1900:::::::60:::::|h[Thunderfury]|h|r",
	[18] = "|cff1eff00|Hitem:15287::::::-1200::60:::::|h[Crusader Bow of the Monkey]|h|r",
	[11] = "|cffa335ee|Hitem:21596::12345:0:0:0:::60:::::|h[Ring]|h|r",
}
function GetInventoryItemLink(_, slot) return links[slot] end
C_SpecializationInfo = { GetActiveSpecGroup = function() return 1 end, GetCombatConfigIDForSpecGroup = function() return 77 end }
C_Traits = {
	GetConfigInfo = function(id) return { treeIDs = { 900 } } end,
	GetTreeNodes = function() return { 1, 2, 3 } end,
	GetNodeInfo = function(_, node)
		if node == 1 then return { ranksPurchased = 3, activeEntry = { entryID = 11 } } end
		if node == 2 then return { ranksPurchased = 0, entryIDs = { 12 } } end
		return { ranksPurchased = 2, entryIDs = { 13 } }
	end,
	GetEntryInfo = function(_, entry) return { definitionID = ({ [11] = DEF1, [12] = 2, [13] = DEF3 })[entry] } end,
}
function GetNumSkillLines() return 3 end
function GetSkillLineInfo(i) return ({ { "Professions", true }, { "Mining", false, nil, 300 }, { "Herbalism", false, nil, 280 } })[i][1], ({ true, false, false })[i], nil, ({ 0, 300, 280 })[i] end
function CreateFrame()
	return { SetScript = function(self, _, f) self.handler = f end, RegisterEvent = function(self, e) events[e] = self end }
end
DEF1, DEF3 = 135489, 142603
C_Timer = { After = function(_, f) f() end }
SlashCmdList = {}
print = function() end

dofile(arg[1] or "testground/server/addon/ForeverSim/ForeverSim.lua")
local frame = events.PLAYER_ENTERING_WORLD
frame.handler(frame, "PLAYER_ENTERING_WORLD")
frame.handler(frame, "PLAYER_LOGOUT")

-- The game's SavedVariables layout: ["key"] = value, lists with -- [n].
local function out(v, indent)
	if type(v) == "table" then
		local lines = { "{" }
		local n = #v
		for i = 1, n do table.insert(lines, indent .. "\t" .. out(v[i], indent .. "\t") .. ", -- [" .. i .. "]") end
		local keys = {}
		for k in pairs(v) do if not (type(k) == "number" and k >= 1 and k <= n) then table.insert(keys, k) end end
		table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
		for _, k in ipairs(keys) do
			local key = type(k) == "number" and ("[" .. k .. "]") or ("[" .. string.format("%q", k) .. "]")
			table.insert(lines, indent .. "\t" .. key .. " = " .. out(v[k], indent .. "\t") .. ",")
		end
		table.insert(lines, indent .. "}")
		return table.concat(lines, "\n")
	elseif type(v) == "string" then
		return string.format("%q", v)
	end
	return tostring(v)
end
io.write("\nForeverSimDB = " .. out(ForeverSimDB, "") .. "\n")
