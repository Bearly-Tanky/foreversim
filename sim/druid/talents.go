package druid

func (druid *Druid) ApplyTalents() {
	// Brambles: applied as Thorns aura points in thorns.go
	// Omen of Clarity is a baseline passive in Forever, not a talent, but it is wired in here with the procs.
	druid.applyOmenOfClarity()
	druid.registerBalanceTalents()
	druid.registerFeralCombatTalents()
	druid.registerRestorationTalents()
}
