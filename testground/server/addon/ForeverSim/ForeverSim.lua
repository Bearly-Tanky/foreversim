-- Forever Sim: saves your character (gear, talents, professions) so the Forever Sim program can
-- import it. The game writes the file when you log out or type /reload; /foreversim shows what
-- was saved.

local VERSION = "1.0.0"
ForeverSimDB = ForeverSimDB or {}

-- Equipment slot → the sim's slot (head, neck, shoulder, back, chest, wrist, hands, waist, legs,
-- feet, finger 1 and 2, trinket 1 and 2, main hand, off hand, ranged).
local SIM_SLOT = { [1] = 0, [2] = 1, [3] = 2, [15] = 3, [5] = 4, [9] = 5, [10] = 6, [6] = 7, [7] = 8, [8] = 9,
	[11] = 10, [12] = 11, [13] = 12, [14] = 13, [16] = 14, [17] = 15, [18] = 16 }

local function num(s)
	return tonumber(s) or 0
end

-- item:ID:enchant:gem1:gem2:gem3:gem4:suffix:...
local function readItem(link)
	local id, enchant, g1, g2, g3, g4, suffix = link:match("item:(%-?%d*):(%-?%d*):(%-?%d*):(%-?%d*):(%-?%d*):(%-?%d*):(%-?%d*)")
	if not id or num(id) == 0 then
		return nil
	end
	local item = { id = num(id) }
	if num(enchant) ~= 0 then item.enchant = num(enchant) end
	local gems = { num(g1), num(g2), num(g3), num(g4) }
	if gems[1] + gems[2] + gems[3] + gems[4] > 0 then item.gems = gems end
	if num(suffix) ~= 0 then item.randomSuffix = math.abs(num(suffix)) end
	return item
end

local function readGear()
	local gear = {}
	for invSlot, simSlot in pairs(SIM_SLOT) do
		local link = GetInventoryItemLink("player", invSlot)
		local item = link and readItem(link)
		if item then gear["slot" .. simSlot] = item end
	end
	return gear
end

local function call(f, ...)
	if not f then return nil end
	local ok, a, b, c, d, e, g, h = pcall(f, ...)
	if ok then return a, b, c, d, e, g, h end
end

local function activeConfigID()
	local SI = C_SpecializationInfo
	if SI and SI.GetActiveSpecGroup and SI.GetCombatConfigIDForSpecGroup then
		local group = call(SI.GetActiveSpecGroup)
		local id = group and call(SI.GetCombatConfigIDForSpecGroup, group)
		if id then return id end
	end
	return C_ClassTalents and call(C_ClassTalents.GetActiveConfigID)
end

-- Forever's talents are one trait tree split into three groups: every purchased node, with the
-- definition it uses (the sim's trees know each talent by that definition).
local function readTalents()
	local T = C_Traits
	if not (T and T.GetConfigInfo and T.GetTreeNodes and T.GetNodeInfo and T.GetEntryInfo) then return nil end
	local configID = activeConfigID()
	local info = configID and call(T.GetConfigInfo, configID)
	local treeID = info and info.treeIDs and info.treeIDs[1]
	if not treeID then return nil end
	local talents = {}
	for _, nodeID in ipairs(call(T.GetTreeNodes, treeID) or {}) do
		local node = call(T.GetNodeInfo, configID, nodeID)
		local ranks = node and tonumber(node.ranksPurchased) or 0
		if ranks > 0 then
			local entryID = (node.activeEntry and node.activeEntry.entryID) or (node.entryIDs and node.entryIDs[1])
			local entry = entryID and call(T.GetEntryInfo, configID, entryID)
			table.insert(talents, { node = nodeID, definition = entry and entry.definitionID or 0, ranks = ranks })
		end
	end
	return talents
end

local function readProfessions()
	local out = {}
	if GetProfessions and GetProfessionInfo then
		for _, index in pairs({ call(GetProfessions) }) do
			if type(index) == "number" then
				local name, _, level, _, _, _, skillLine = call(GetProfessionInfo, index)
				if name then table.insert(out, { name = name, level = level or 0, skillLine = skillLine or 0 }) end
			end
		end
	elseif GetNumSkillLines and GetSkillLineInfo then
		for i = 1, call(GetNumSkillLines) or 0 do
			local name, isHeader, _, rank = call(GetSkillLineInfo, i)
			if name and not isHeader then table.insert(out, { name = name, level = rank or 0 }) end
		end
	end
	return out
end

local function save()
	local name, realm = UnitName("player"), GetRealmName()
	if not name or name == UNKNOWNOBJECT then return end
	local _, classFile, classID = UnitClass("player")
	local _, raceFile, raceID = UnitRace("player")
	ForeverSimDB.characters = ForeverSimDB.characters or {}
	local old = ForeverSimDB.characters[name .. "-" .. realm] or {}
	ForeverSimDB.version = VERSION
	ForeverSimDB.characters[name .. "-" .. realm] = {
		name = name,
		realm = realm,
		classID = classID,
		class = classFile,
		raceID = raceID,
		race = raceFile,
		sex = UnitSex("player"),
		level = UnitLevel("player"),
		gear = readGear(),
		-- Talents read before the client has them keep the last good reading.
		talents = readTalents() or old.talents,
		professions = readProfessions(),
		saved = time(),
	}
end

local frame = CreateFrame("Frame")
local pending
frame:SetScript("OnEvent", function(_, event)
	if event == "PLAYER_LOGOUT" then
		save()
		return
	end
	-- Equipping a set fires one event per slot: save once they settle.
	if not pending then
		pending = true
		C_Timer.After(1, function()
			pending = nil
			save()
		end)
	end
end)
for _, event in ipairs({ "PLAYER_ENTERING_WORLD", "PLAYER_EQUIPMENT_CHANGED", "TRAIT_CONFIG_UPDATED", "SKILL_LINES_CHANGED", "PLAYER_LEVEL_UP", "PLAYER_LOGOUT" }) do
	pcall(frame.RegisterEvent, frame, event)
end

SLASH_FOREVERSIM1 = "/foreversim"
SlashCmdList.FOREVERSIM = function()
	save()
	local c = ForeverSimDB.characters[UnitName("player") .. "-" .. GetRealmName()]
	local items, talents = 0, 0
	for _ in pairs(c.gear) do items = items + 1 end
	for _, t in ipairs(c.talents or {}) do talents = talents + t.ranks end
	print(string.format("|cffffd23cForever Sim|r: saved %s (%d items, %d talent points). Type /reload or log out, then import it in the Forever Sim program.", c.name, items, talents))
end
