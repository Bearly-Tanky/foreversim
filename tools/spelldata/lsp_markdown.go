package main

import (
	"fmt"
	"strings"

	"github.com/wowsims/forever/sim/core/spelldata"
)

func cell(text string) string {
	return strings.ReplaceAll(text, "|", `\|`)
}

func codeCell(text string) string {
	return "`" + cell(text) + "`"
}

func idMarkdown(s *spelldata.Spell) string {
	var md strings.Builder
	newCard(s, s.Rank, 0).writeMarkdown(&md)
	return md.String()
}

func familyMarkdown(f *ladderFamily) string {
	var md strings.Builder
	fmt.Fprintf(&md, "### %s\n\n", f.key())
	rows := familyRows(f)
	if len(rows) > 0 && rows[0].Value != "" {
		md.WriteString("| id | name | rank | call | value |\n|--:|:--|:--|:--|:--|\n")
		for _, row := range rows {
			fmt.Fprintf(&md, "| %d | %s | %s | %s | %s |\n", row.ID, cell(row.Name), cell(row.Rank), codeCell(row.Accessor), cell(row.Value))
		}
	} else {
		md.WriteString("| id | name | rank | call |\n|--:|:--|:--|:--|\n")
		for _, row := range rows {
			fmt.Fprintf(&md, "| %d | %s | %s | %s |\n", row.ID, cell(row.Name), cell(row.Rank), codeCell(row.Accessor))
		}
	}
	md.WriteString("\n")
	highest := f.ladder.Highest()
	newCard(highest, rankLabel(f, highest), 0).writeMarkdown(&md)
	return md.String()
}

func exprMarkdown(result *exprResult, hover chainHover) string {
	var md strings.Builder
	c := result.card()
	called := ""
	if n := len(hover.chain.segments); n > 0 {
		called = hover.chain.segments[n-1].text(true)
	}

	switch result.kind {
	case kindSpell:
		c.writeMarkdown(&md)

	case kindEffect:
		fmt.Fprintf(&md, "`%s` = **%s** of %s\n\n", called, result.value, c.heading())
		fmt.Fprintf(&md, "`%s`\n", result.trail)
		if result.readEffect > 0 {
			effectTable(&md, c.Effects, true)
		}
		if len(result.accessors) > 0 {
			md.WriteString("\n")
		}
		for _, accessor := range result.accessors {
			fmt.Fprintf(&md, "`%s`  \n", accessor)
		}
		fmt.Fprintf(&md, "\n[Wowhead](%s)\n", c.Wowhead)

	default:
		label := called
		if hover.name != "" {
			label = hover.name
		}
		fmt.Fprintf(&md, "`%s` = **%s**\n\n", label, result.value)
		fmt.Fprintf(&md, "`%s`\n\n", result.trail)
		c.writeMarkdown(&md)
	}
	return md.String()
}
